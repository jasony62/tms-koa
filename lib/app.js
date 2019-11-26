const fs = require('fs')
const Koa = require('koa')
const koaBody = require('koa-body')
const koaStatic = require('koa-static')
const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-koa')

class TmsKoa extends Koa {
  /**
   *
   * @param {*} options
   */
  constructor(options) {
    super(options)
  }
  /**
   * 获得配置信息
   */
  fsConfigByFile() {
    let fsConfigPath = process.cwd() + '/config/fs.js'
    if (!fs.existsSync(fsConfigPath)) {
      logger.warn(`文件服务配置文件(${fsConfigPath})不存在`)
      return false
    }
    let fsConfig = require(fsConfigPath)
    return fsConfig
  }
  /**
   * 初始化文件服务
   *
   * @param {object} fsConfig
   */
  async fsInit(fsConfig) {
    if (typeof fsConfig.local !== 'object') {
      logger.warn(`文件服务配置文件中没有指定本地文件服务信息`)
      return false
    }
    if (typeof fsConfig.local.database !== 'object') {
      logger.warn(`文件服务配置文件中没有指定数据库`)
      return false
    }
    if (fsConfig.local.schemas && !Array.isArray(fsConfig.local.schemas)) {
      logger.warn(`文件服务配置文件中指定的扩展信息定义不是数组`)
      return false
    }
    // 数据库设置
    let fsDb = fsConfig.local.database
    if (typeof fsDb.dialect !== 'string' || !fsDb.dialect) {
      return false
    }
    let DbContext = require('tms-db').DbContext
    if (!DbContext || !DbContext.isAvailable(fsDb.dialect)) {
      logger.error(`文件服务配置文件中指定的数据库[${fsDb.dialect}]不可用`)
      return false
    }
    if (typeof fsDb.file_table !== 'string' || !fsDb.file_table) {
      logger.error(`文件服务配置文件中指定[file_table]不可用`)
      return false
    }
    // 扩展信息设置
    let fsSchemas = fsConfig.local.schemas
    if (
      fsSchemas &&
      fsSchemas.some(s => typeof s.id !== 'string' || s.id.length === 0)
    ) {
      logger.error(`文件服务配置文件中指定的扩展信息定义不符合要求`)
      return false
    }

    let dbContext = new DbContext({ dialects: [fsDb.dialect] })
    try {
      // 文件记录表
      let stmt = dbContext.db().newSelectOne('sqlite_master', '*')
      stmt.where
        .fieldMatch('type', '=', 'table')
        .fieldMatch('name', '=', fsDb.file_table)
      let tbl = await stmt.exec()
      if (!tbl) {
        let columns = [
          'id integer PRIMARY KEY autoincrement',
          'userid text',
          'path text'
        ]
        if (fsSchemas) {
          fsSchemas.forEach(s => {
            columns.push(`${s.id} text`)
          })
        }
        let sqlCreateTable = `create table ${fsDb.file_table}(${columns.join(
          ','
        )})`
        await dbContext.db().execSql(sqlCreateTable, { useWritableConn: true })
        logger.info(`创建文件服务数据库表[${fsDb.file_table}]`)
      }
    } catch (err) {
      logger.error(`文件服务初始化失败`, err)
    }
    logger.info(`完成文件服务设置。`)
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
      logger.warn(`应用配置文件(${appConfigPath})不存在`)
      appConfig = { port: 3000 }
    }
    /**
     * 启动数据库连接池
     */
    let DbContext
    let dbConfigPath = process.cwd() + '/config/db.js'
    if (fs.existsSync(dbConfigPath)) {
      let dbConfig = require(dbConfigPath)
      DbContext = require('tms-db').DbContext
      await DbContext.init(dbConfig).catch(err => {
        logger.warn(err)
      })
    } else {
      logger.warn(`数据库连接配置文件(${dbConfigPath})不存在`)
    }
    /**
     * 文件管理模块初始化
     */
    let fsConfig = this.fsConfigByFile()
    if (fsConfig) this.fsInit(fsConfig)
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
     * 获得access_token
     */
    if (fs.existsSync(process.cwd() + '/config/redis.js')) {
      let router = require('./auth/router')
      this.use(router.routes())
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
    if (fs.existsSync(process.cwd() + '/config/app.js')) {
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
  DbModel,
  ResultData,
  ResultFault,
  ResultObjectNotFound
}
