const fs = require('fs')
const Koa = require('koa')
const koaBody = require('koa-body')
const koaStatic = require('koa-static')
const cors = require('@koa/cors')
const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-koa')
let DbContext, MongoContext, MongooseContext, RedisContext
const Context = {}
process.on('uncaughtException', err => {
  logger.warn('uncaughtException error:', err)
})
process.on('unhandledRejection', reason => {
  logger.warn('Unhandled Rejection reason:', reason)
})

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
    let appConfig
    let appConfigPath = process.cwd() + '/config/app.js'
    if (fs.existsSync(appConfigPath)) {
      appConfig = require(process.cwd() + '/config/app')
    } else {
      logger.warn(`应用配置文件[${appConfigPath}]不存在`)
      appConfig = { port: 3000 }
    }
    /**
     * 启动数据库连接池
     */
    let dbConfigPath = process.cwd() + '/config/db.js'
    if (fs.existsSync(dbConfigPath)) {
      let dbConfig = require(dbConfigPath)
      if (dbConfig.disabled !== true) {
        DbContext = require('tms-db').DbContext
        await DbContext.init(dbConfig).catch(e => {
          let logMsg = `初始化[${dbConfigPath}]失败`
          logger.isDebugEnabled()
            ? logger.debug(logMsg, e)
            : logger.warn(logMsg)
        })
        Context.DbContext = DbContext
      }
    } else {
      logger.warn(`数据库连接配置文件[${dbConfigPath}]不存在`)
    }
    /**
     * 初始化mongodb
     */
    let mongoConfigPath = process.cwd() + '/config/mongodb.js'
    if (fs.existsSync(mongoConfigPath)) {
      let mongoConfig = require(mongoConfigPath)
      if (mongoConfig.disabled !== true) {
        MongoContext = require('./mongodb').Context
        try {
          await MongoContext.init(mongoConfig)
          Context.MongoContext = MongoContext
        } catch (e) {
          let logMsg = `初始化[${mongoConfigPath}]失败`
          logger.isDebugEnabled()
            ? logger.debug(logMsg, e)
            : logger.warn(logMsg)
        }
      }
    } else {
      logger.warn(`MongoDb连接配置文件[${mongoConfigPath}]不存在`)
    }
    /**
     * 初始化mongoose
     */
    let mongooseConfigPath = process.cwd() + '/config/mongoose.js'
    if (fs.existsSync(mongooseConfigPath)) {
      let mongooseConfig = require(mongooseConfigPath)
      if (mongooseConfig.disabled !== true) {
        MongooseContext = require('./mongoose').Context
        try {
          await MongooseContext.init(mongooseConfig)
          Context.MongooseContext = MongooseContext
        } catch (e) {
          let logMsg = `初始化[${mongooseConfigPath}]失败`
          logger.isDebugEnabled()
            ? logger.debug(logMsg, e)
            : logger.warn(logMsg)
        }
      }
    } else {
      logger.warn(`Mongoose连接配置文件[${mongooseConfigPath}]不存在`)
    }
    /**
     * 初始化redis
     */
    let redisConfigPath = process.cwd() + '/config/redis.js'
    if (fs.existsSync(redisConfigPath)) {
      const redisConfig = require(redisConfigPath)
      if (redisConfig.disabled !== true) {
        RedisContext = require('./redis').Context
        try {
          await RedisContext.init(redisConfig)
          Context.RedisContext = RedisContext
        } catch (e) {
          let logMsg = `初始化[${redisConfigPath}]失败`
          logger.isDebugEnabled()
            ? logger.debug(logMsg, e)
            : logger.warn(logMsg)
        }
      }
    } else {
      logger.warn(`Redis连接配置文件[${redisConfigPath}]不存在`)
    }
    /**
     * 文件管理模块初始化
     */
    if (MongoContext) {
      let fsConfigPath = process.cwd() + '/config/fs.js'
      if (fs.existsSync(fsConfigPath)) {
        let fsConfig = require(fsConfigPath)
        if (fsConfig) {
          const { Info } = require('./model/fs/info')
          try {
            await Info.init(fsConfig)
          } catch (e) {
            let logMsg = `初始化[${fsConfigPath}]失败`
            logger.isDebugEnabled()
              ? logger.debug(logMsg, e)
              : logger.warn(logMsg)
          }
        }
      } else {
        logger.warn(`文件服务配置文件(${fsConfigPath})不存在`)
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
     * 支持post，上传文件
     */
    this.use(
      koaBody({
        multipart: true,
        formidable: {
          maxFileSize: 200 * 1024 * 1024
        }
      })
    )
    /**
     * 支持跨域
     */
    this.use(cors())
    /**
     * 获得access_token
     */
    if (appConfig.auth && appConfig.auth.disabled !== false) {
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
      beforeController.forEach(m => this.use(m))
    }
    /**
     * 控制器
     */
    if (fs.existsSync(appConfigPath)) {
      let router = require('./controller/router')
      this.use(router.routes())
    }
    /**
     * 其他中间件
     */
    if (Array.isArray(afterController)) {
      afterController.forEach(m => this.use(m))
    }

    this.listen(appConfig.port, () => {
      logger.info(`完成启动，开始监听端口：${appConfig.port}`)
    })
  }
}
/**
 * 对外接口
 */
const { Client } = require('./auth/client')
const { Captcha } = require('./auth/captcha')
const { Ctrl } = require('./controller/ctrl')
const { DbModel } = require('./model')
const { ResultData, ResultFault, ResultObjectNotFound } = require('./response')

module.exports = {
  TmsKoa,
  Client,
  Captcha,
  Ctrl,
  Context,
  DbModel,
  RedisContext,
  ResultData,
  ResultFault,
  ResultObjectNotFound
}
