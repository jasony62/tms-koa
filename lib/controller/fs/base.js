const { Ctrl } = require('../ctrl')
const { ResultData } = require('../../response')
const { Info } = require('../../model/fs/info')

/**
 * 文件管理控制器
 */
class BaseCtrl extends Ctrl {
  constructor(...args) {
    super(...args)
    const fsConfig = require(process.cwd() + '/config/fs')
    this.fsConfig = fsConfig
  }
  /**
   * 返回扩展信息定义
   */
  async schemas() {
    const mlInfo = await Info.ins()
    let schemas = mlInfo.schemas

    return new ResultData(schemas)
  }
  /**
   * 设置上传文件信息
   */
  async setInfo() {
    const { path } = this.request.query
    const info = this.request.body
    info.userid = this.client ? this.client.id : ''

    const mlInfo = await Info.ins()
    mlInfo.set(path, info)

    return new ResultData('ok')
  }
}
module.exports = { BaseCtrl, ResultData }
