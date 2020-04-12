const fs = require('fs')
const path = require('path')
const _ = require('lodash')
const Koa = require('koa')
const koaBody = require('koa-body')
const koaStatic = require('koa-static')
const cors = require('@koa/cors')
const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-koa')

// 初始化配置信息
let DbContext, MongoContext, MongooseContext, RedisContext, FsContext
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
  async startup({ beforeController, afterController } = {}) {
    /**
     * 应用配置
     */
    const appConfig = loadConfig('app', { port: 3000 })
    Context.appConfig = appConfig
    /**
     * 启动数据库连接池
     */
    const dbConfig = loadConfig('db')
    if (dbConfig && dbConfig.disabled !== true) {
      DbContext = require('tms-db').DbContext
      await DbContext.init(dbConfig).catch((e) => {
        let logMsg = `初始化[db]配置失败`
        logger.isDebugEnabled() ? logger.debug(logMsg, e) : logger.warn(logMsg)
      })
      Context.DbContext = DbContext
    }
    /**
     * 初始化mongodb
     */
    const mongoConfig = loadConfig('mongodb')
    if (mongoConfig && mongoConfig.disabled !== true) {
      MongoContext = require('./mongodb').Context
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
      MongooseContext = require('./mongoose').Context
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
      RedisContext = require('./redis').Context
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
      FsContext = require('./fs').Context
      try {
        await FsContext.init(fsConfig)
        Context.FsContext = FsContext
      } catch (e) {
        let logMsg = `初始化[fs]配置失败`
        logger.isDebugEnabled() ? logger.debug(logMsg, e) : logger.warn(logMsg)
      }
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
    if (FsContext) {
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
    this.use(cors())
    /**
     * 获得access_token
     */
    if (appConfig.auth && appConfig.auth.disabled !== true) {
      let authConfig = appConfig.auth
      let mode
      if (typeof authConfig.jwt === 'object') {
        let { privateKey, expiresIn } = authConfig.jwt
        if (typeof privateKey === 'string') {
          mode = 'jwt'
          if (!expiresIn) authConfig.jwt.expiresIn = 3600
        } else logger.warn(`启用API调用认证机制[jwt]失败，参数不完整`)
      } else if (typeof authConfig.redis === 'object') {
        let { host, port } = authConfig.redis
        if (typeof host === 'string' && typeof port === 'number') {
          try {
            await require('./redis').Context.init({ host, port })
            mode = 'redis'
          } catch (e) {
            let logMsg = `启用API调用认证机制[redis]失败，${e.message}`
            logger.isDebugEnabled()
              ? logger.debug(logMsg, e)
              : logger.warn(logMsg)
          }
        } else logger.warn(`启用API调用认证机制[redis]失败，参数不完整`)
      }
      if (mode) {
        let router = require('./auth/router')
        this.use(router.routes())
        logger.info(`启用API调用认证机制[${mode}]`)
      }
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
    if (appConfig) {
      let router = require('./controller/router')
      this.use(router.routes())
    }
    /**
     * 其他中间件
     */
    if (Array.isArray(afterController)) {
      afterController.forEach((m) => this.use(m))
    }

    this.listen(appConfig.port, () => {
      logger.info(`完成启动，开始监听端口：${appConfig.port}`)
    })
  }
}
/**
 * 对外接口
 */
module.exports = {
  TmsKoa,
  Context,
}
