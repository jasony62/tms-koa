const fs = require('fs')
const { Ctrl } = require('../ctrl')
const { ResultData, ResultFault } = require('../../response')
const { Info } = require('../../model/fs/info')
const FsContext = require('../../fs').Context

/**
 * 文件管理控制器
 */
class BaseCtrl extends Ctrl {
  constructor(...args) {
    super(...args)
    if (!FsContext.insSync) throw new Error('文件服务不可用')
    this.fsContext = FsContext.insSync()
  }
  /**
   * 检查访问权限
   */
  async tmsBeforeEach() {
    this.domain = 'upload'
    this.bucket = ''

    if (!this.fsContext.aclValidator) return true

    const { client, path } = this
    if (!client || !path) return true

    const result = await this.fsContext.aclValidator(
      client,
      this.domain,
      this.bucket,
      path
    )
    if (result !== true) return new ResultFault('没有访问指定目录或文件的权限')

    return true
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
