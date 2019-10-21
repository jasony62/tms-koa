const fs = require('fs')
const _ = require('lodash')
const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-koa-fs')
const { Ctrl } = require('../ctrl')
const { ResultData, ResultFault } = require('../../response')
/**
 * 文件管理控制器
 */
class BaseCtrl extends Ctrl {
  constructor(...args) {
    super(...args)
    const fsConfig = require(process.cwd() + '/config/fs')
    this.fsConfig = fsConfig
  }
  get fsDb() {
    let dialect = _.get(this.fsConfig, ['local', 'database', 'dialect'])
    if (!dialect) {
      return false
    }
    const dbCtx = this.dbContext
    let fsDb = dbCtx[dialect]

    return fsDb
  }
  /**
   * 返回扩展信息定义
   */
  schemas() {
    let fsConfigPath = process.cwd() + '/config/fs.js'
    if (!fs.existsSync(fsConfigPath)) {
      return new ResultFault('没有配置文件服务')
    }
    let fsConfig = require(fsConfigPath)

    let { schemas } = fsConfig.local
    if (!Array.isArray(schemas)) {
      return new ResultFault('文件服务没有设置扩展信息定义')
    }

    return new ResultData(schemas)
  }
  /**
   * 设置上传文件信息
   */
  async setInfo() {
    const fsDatabase = _.get(this.fsConfig, ['local', 'database'])
    if (typeof fsDatabase !== 'object') {
      logger.warn('不支持设置上传文件信息，没有指定配置对象')
      return new ResultFault('不支持设置上传文件信息(1)')
    }
    if (typeof fsDatabase.dialect !== 'string') {
      logger.warn('不支持设置上传文件信息，没有指定数据库类型')
      return new ResultFault('不支持设置上传文件信息(2)')
    }
    if (typeof fsDatabase.file_table !== 'string') {
      logger.warn('不支持设置上传文件信息，没有指定数据库表')
      return new ResultFault('不支持设置上传文件信息(3)')
    }
    const dbCtx = this.dbContext
    if (!dbCtx[fsDatabase.dialect]) {
      logger.error('指定保存上传文件信息信息的数据库不存在')
      return new ResultFault('不支持设置上传文件信息(3)')
    }
    let fsDb = dbCtx[fsDatabase.dialect]

    const { path } = this.request.query
    const info = this.request.body

    try {
      let { file_table } = fsDatabase
      let stmt = fsDb.newSelectOne(file_table, '*')
      stmt.where.fieldMatch('path', '=', path)
      let beforeInfo = await stmt.exec()
      if (beforeInfo) {
        stmt = fsDb.newUpdate(file_table, info)
        stmt.where.fieldMatch('path', '=', path)
      } else {
        info.userid = this.client ? this.client.id : ''
        info.path = path
        stmt = fsDb.newInsert(file_table, info)
      }
      let affectedRow = await stmt.exec()
      if (affectedRow !== 1) {
        let msg = '设置上传文件信息失败：未知原因'
        logger.warn(msg)
        return new ResultFault(msg)
      }
    } catch (err) {
      logger.error(`设置上传文件信息失败：${err}`, err)
      return new ResultFault(err)
    }

    return new ResultData('ok')
  }
}
module.exports = { BaseCtrl, ResultData }
