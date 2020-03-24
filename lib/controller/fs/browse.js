const { BaseCtrl } = require('./base')
const { ResultData } = require('../../response')
const { LocalFS } = require('../../model/fs/local')
const { Info } = require('../../model/fs/info')

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
  async getBizInfo(path) {
    const mlInfo = await Info.ins()
    const info = await mlInfo.get(path)

    if (info) delete info.path

    return info
  }
  /**
   *
   */
  async list() {
    let { dir } = this.request.query
    let localFS = new LocalFS(this.domain, this.bucket)
    let { files, dirs } = localFS.list(dir)
    for (let i = 0, ii = files.length; i < ii; i++) {
      let file = files[i]
      let info = await this.getBizInfo(file.path)
      file.info = typeof info === 'object' ? info : {}
    }

    return new ResultData({ files, dirs })
  }
}
module.exports = { BrowseCtrl, ResultData }
