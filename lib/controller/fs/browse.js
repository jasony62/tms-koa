const { BaseCtrl } = require('./base')
const { ResultData, ResultFault } = require('../../response')
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
   * @param {string} path
   */
  async getBizInfo(path) {
    const fsInfo = await Info.ins(this.domain)
    if (!fsInfo) return new ResultFault('不支持设置文件信息')

    const info = await fsInfo.get(path)

    if (info) delete info.path

    return info
  }
  /**
   * 返回文件列表
   */
  async list() {
    let { dir } = this.request.query
    let localFS = new LocalFS(this.domain, this.bucket)
    let { files, dirs } = localFS.list(dir)
    for (let i = 0, ii = files.length; i < ii; i++) {
      let file = files[i]
      let info = await this.getBizInfo(file.path)
      file.info = info instanceof ResultFault ? {} : info
    }

    return new ResultData({ files, dirs })
  }
}
module.exports = { BrowseCtrl, ResultData }
