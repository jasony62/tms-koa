const { Ctrl } = require('../ctrl')
const { ResultData } = require('../../response')
const { LocalFS } = require('../../model/fs/local')
/**
 * 文件管理控制器
 */
class BrowseCtrl extends Ctrl {
  constructor(...args) {
    super(...args)
  }
  /**
   *
   */
  list() {
    let { dir } = this.request.query
    const fileConfig = require(process.cwd() + '/config/fs')
    let localFS = new LocalFS('tests', { fileConfig })
    let { files, dirs } = localFS.list(dir)

    return new ResultData({ files, dirs })
  }
}
module.exports = { BrowseCtrl, ResultData }
