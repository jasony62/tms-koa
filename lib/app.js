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
   * 启动应用
   */
  async startup() {
    // 启动检查
    const appConfig = require(process.cwd() + '/config/app')
    /**
     * 启动数据库连接池
     */
    let pathOrConfig = process.cwd() + '/config/db.js'
    if (fs.existsSync(pathOrConfig)) {
      let dbConfig = require(pathOrConfig)
      const { DbContext } = require('tms-db')
      await DbContext.init(dbConfig).catch(err => {
        logger.warn(err)
      })
    } else {
      logger.warn(`数据库连接配置文件(${pathOrConfig})不存在`)
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
     * 获得access_token
     */
    let router = require('./auth/router')
    this.use(router.routes())
    /**
     * 控制器
     */
    router = require('./controller/router')
    this.use(router.routes())

    this.listen(appConfig.port)
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
