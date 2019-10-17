const _ = require('lodash')
const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-koa-upload')
const { Ctrl } = require('../ctrl')
const { ResultData, ResultFault } = require('../../response')
const { UploadPlain } = require('../../model/fs/upload')
/**
 * 文件管理控制器（上传）
 */
class UploadCtrl extends Ctrl {
  constructor(...args) {
    super(...args)
  }
  /**
   * 上传单个文件
   */
  plain() {
    if (!this.request.files || !this.request.files.file) {
      return new ResultFault('没有上传文件')
    }

    const file = this.request.files.file
    const upload = new UploadPlain()
    const filepath = upload.store(file)

    return new ResultData(filepath)
  }
  /**
   * 设置上传文件信息
   */
  async setInfo() {
    const fsConfig = require(process.cwd() + '/config/fs')
    const fsDatabase = _.get(fsConfig, ['local', 'database'])
    if (typeof fsDatabase !== 'object') {
      logger.warn('不支持设置上传文件信息，没有指定配置对象')
      return new ResultFault('不支持设置上传文件信息(1)')
    }
    if (typeof fsDatabase.dialect !== 'string') {
      logger.warn('不支持设置上传文件信息，没有指定数据库类型')
      return new ResultFault('不支持设置上传文件信息(2)')
    }
    if (typeof fsDatabase.table !== 'string') {
      logger.warn('不支持设置上传文件信息，没有指定数据库表')
      return new ResultFault('不支持设置上传文件信息(3)')
    }
    const dbCtx = this.dbContext
    if (!dbCtx[fsDatabase.dialect]) {
      logger.error('指定保存上传文件信息信息的数据库不存在')
      return new ResultFault('不支持设置上传文件信息(3)')
    }
    const { path } = this.request.query
    const info = this.request.body

    let fsDb = dbCtx[fsDatabase.dialect]

    try {
      let { file_table } = fsDatabase
      let stmt = fsDb.newSelectOne(file_table, '*')
      stmt.where.fieldMatch('path', '=', path)
      let beforeInfo = await stmt.exec()
      if (beforeInfo) {
        stmt = fsDb.newUpdate(file_table, info)
        stmt.where.fieldMatch('path', '=', path)
      } else {
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
      logger.error(`设置上传文件信息失败：${err}`)
      return new ResultFault(err)
    }

    return new ResultData('ok')
  }
}
module.exports = { UploadCtrl, ResultData }
