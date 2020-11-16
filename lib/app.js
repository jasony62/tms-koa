const fs = require('fs')
const path = require('path')
const http = require('http')
const https = require('https')
const _ = require('lodash')
const Koa = require('koa')
const koaBody = require('koa-body')
const koaStatic = require('koa-static')
const cors = require('@koa/cors')
const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-koa')
require('dotenv-flow').config()

// 初始化配置信息
let AppContext,
  DbContext,
  MongoContext,
  MongooseContext,
  RedisContext,
  FsContext,
  PushContext,
  SwaggerContext
const Context = {}

process.on('uncaughtException', (err) => {
  logger.warn('uncaughtException error:', err)
})
process.on('unhandledRejection', (reason) => {
  logger.warn('Unhandled Rejection reason:', reason)
})
/**
 * 获得配置数据
 *
 * @param {*} name
 * @param {*} defaultConfig
 */
function loadConfig(name, defaultConfig) {
  let basepath = path.resolve('config', `${name}.js`)
  let baseConfig
  if (fs.existsSync(basepath)) {
    baseConfig = require(basepath)
    logger.info(`从[${basepath}]加载配置`)
  } else {
    logger.warn(`[${name}]配置文件[${basepath}]不存在`)
  }
  let localpath = path.resolve('config', `${name}.local.js`)
  let localConfig
  if (fs.existsSync(localpath)) {
    localConfig = require(localpath)
    logger.info(`从[${localpath}]加载本地配置`)
  }
  if (defaultConfig || baseConfig || localConfig) {
    return _.merge({}, defaultConfig, baseConfig, localConfig)
  }

  return false
}

class TmsKoa extends Koa {
  /**
   *
   * @param {*} options
   */
  constructor(options) {
    super(options)
  }
  /**
   * 启动应用
   */
  async startup({ beforeController, afterController, afterInit } = {}) {
    /**
     * 应用配置
     */
    const appConfig = loadConfig('app', { port: 3000 })
    AppContext = require('./context/app').Context
    try {
      await AppContext.init(appConfig)
      Context.AppContext = AppContext
    } catch (e) {
      let logMsg = `初始化[app]配置失败`
      logger.isDebugEnabled() ? logger.debug(logMsg, e) : logger.warn(logMsg)
      process.exit(0)
    }
    /**
     * 启动数据库连接池
     */
    const dbConfig = loadConfig('db')
    if (dbConfig && dbConfig.disabled !== true) {
      DbContext = require('tms-db').DbContext
      try {
        await DbContext.init(dbConfig)
        Context.DbContext = DbContext
      } catch (e) {
        let logMsg = `初始化[db]配置失败`
        logger.isDebugEnabled() ? logger.debug(logMsg, e) : logger.warn(logMsg)
      }
    }
    /**
     * 初始化mongodb
     */
    const mongoConfig = loadConfig('mongodb')
    if (mongoConfig && mongoConfig.disabled !== true) {
      MongoContext = require('./context/mongodb').Context
      try {
        await MongoContext.init(mongoConfig)
        Context.MongoContext = MongoContext
      } catch (e) {
        let logMsg = `初始化[mongodb]配置失败`
        logger.isDebugEnabled() ? logger.debug(logMsg, e) : logger.warn(logMsg)
      }
    }
    /**
     * 初始化mongoose
     */
    const mongooseConfig = loadConfig('mongoose')
    if (mongooseConfig && mongooseConfig.disabled !== true) {
      MongooseContext = require('./context/mongoose').Context
      try {
        await MongooseContext.init(mongooseConfig)
        Context.MongooseContext = MongooseContext
      } catch (e) {
        let logMsg = `初始化[mongoose]配置失败`
        logger.isDebugEnabled() ? logger.debug(logMsg, e) : logger.warn(logMsg)
      }
    }
    /**
     * 初始化redis
     */
    const redisConfig = loadConfig('redis')
    if (redisConfig && redisConfig.disabled !== true) {
      RedisContext = require('./context/redis').Context
      try {
        await RedisContext.init(redisConfig)
        Context.RedisContext = RedisContext
      } catch (e) {
        let logMsg = `初始化[redis]配置失败`
        logger.isDebugEnabled() ? logger.debug(logMsg, e) : logger.warn(logMsg)
      }
    }
    /**
     * 文件管理模块初始化
     */
    const fsConfig = loadConfig('fs')
    if (fsConfig) {
      FsContext = require('./context/fs').Context
      try {
        await FsContext.init(fsConfig)
        Context.FsContext = FsContext
      } catch (e) {
        let logMsg = `初始化[fs]配置失败`
        logger.isDebugEnabled() ? logger.debug(logMsg, e) : logger.warn(logMsg)
      }
    }
    /**
     * 推送服务模块初始化
     */
    const pushConfig = loadConfig('push')
    if (pushConfig) {
      PushContext = require('./context/push').Context
      try {
        await PushContext.init(pushConfig)
        Context.PushContext = PushContext
      } catch (e) {
        let logMsg = `初始化[push]配置失败`
        logger.isDebugEnabled() ? logger.debug(logMsg, e) : logger.warn(logMsg)
      }
    }
    /**
     * Swagger服务模块初始化
     */
    const swaggerConfig = loadConfig('swagger')
    if (swaggerConfig) {
      SwaggerContext = require('./context/swagger').Context
      try {
        await SwaggerContext.init(swaggerConfig)
        Context.SwaggerContext = SwaggerContext
      } catch (e) {
        let logMsg = `初始化[Swagger]配置失败`
        logger.isDebugEnabled() ? logger.debug(logMsg, e) : logger.warn(logMsg)
      }
    }
    /**
     * 开放Swagger服务
     */
    if (Context.SwaggerContext) {
      let swaggerRouter = require('./swagger/router')
      this.use(swaggerRouter.routes())
    }
    /**
     * 支持访问静态文件
     */
    let staticPath = process.cwd() + '/public'
    if (fs.existsSync(staticPath)) {
      this.use(koaStatic(staticPath))
    }
    /**
     * 开放文件服务的下载服务
     */
    if (Context.FsContext) {
      let diskRouter = require('./fsdomain/router')
      this.use(diskRouter.routes())
    }
    /**
     * 支持post，上传文件
     */
    this.use(
      koaBody({
        multipart: true,
        formidable: {
          maxFileSize: 200 * 1024 * 1024,
        },
      })
    )
    /**
     * 支持跨域
     */
    const corsOptions = _.get(AppContext.insSync(), 'cors')
    this.use(cors(corsOptions))
    /**
     * 获得access_token
     */
    const authMode = _.get(AppContext.insSync(), 'auth.mode')
    if (authMode) {
      let router = require('./auth/router')
      this.use(router.routes())
      logger.info(`启用API调用认证机制[${authMode}]`)
    }
    /**
     * 其他中间件
     */
    if (Array.isArray(beforeController)) {
      beforeController.forEach((m) => this.use(m))
    }
    /**
     * 控制器
     */
    let router = require('./controller/router')
    this.use(router.routes())
    /**
     * 其他中间件
     */
    if (Array.isArray(afterController)) {
      afterController.forEach((m) => this.use(m))
    }
    /**
     * 初始化完成后
     */
    if (afterInit && typeof afterInit === 'function') {
      await afterInit(Context)
    }
    /**
     * 启用端口
     */
    let serverCallback = this.callback()
    const appContext = AppContext.insSync()
    try {
      const httpServer = http.createServer(serverCallback)
      httpServer.listen(appContext.port, (err) => {
        if (err) {
          logger.error(`启动http端口【${appContext.port}】失败: `, err)
        } else {
          logger.info(`完成启动http端口：${appContext.port}`)
        }
      })
    } catch (ex) {
      logger.error('启动http服务失败\n', ex, ex && ex.stack)
    }
    /**
     * 支持https
     */
    if (
      typeof appContext.https === 'object' &&
      appContext.https.disabled !== true
    ) {
      const { port, key, cert } = appContext.https
      try {
        const httpsServer = https.createServer(
          {
            key: fs.readFileSync(key, 'utf8').toString(),
            cert: fs.readFileSync(cert, 'utf8').toString(),
          },
          serverCallback
        )
        httpsServer.listen(port, (err) => {
          if (err) {
            logger.error(`启动https端口【${port}】失败: `, err)
          } else {
            logger.info(`完成启动https端口：${port}`)
          }
        })
      } catch (ex) {
        logger.error('启动https服务失败\n', ex, ex && ex.stack)
      }
    }
  }
}
/**
 * 对外接口
 */
module.exports = {
  TmsKoa,
  Context,
}
