const _ = require('lodash')
const { BaseCtrl } = require('./base')
const { ResultData } = require('../../response')
const { LocalFS } = require('../../model/fs/local')

/**
 * 文件管理控制器
 */
class BrowseCtrl extends BaseCtrl {
  constructor(...args) {
    super(...args)
  }
  /**
   * 文件的业务信息
   *
   * @param {string} relativePath
   */
  async getBizInfo(relativePath) {
    let tbl = _.get(this.fsConfig, ['local', 'database', 'file_table'], '')
    if (!tbl) return false

    let fsDb = this.fsDb
    if (!fsDb) return false

    let stmt = fsDb.newSelectOne(tbl, '*')
    stmt.where.fieldMatch('path', '=', relativePath)
    let info = await stmt.exec()

    if (info) delete info.path

    return info
  }
  /**
   *
   */
  async list() {
    let { dir } = this.request.query
    let localFS = new LocalFS('upload', { fileConfig: this.fsConfig })
    let { files, dirs } = localFS.list(dir)
    for (let i = 0, ii = files.length; i < ii; i++) {
      let file = files[i]
      let info = await this.getBizInfo(file.path)
      file.info = info
    }

    return new ResultData({ files, dirs })
  }
}
module.exports = { BrowseCtrl, ResultData }
