const { Ctrl } = require('../ctrl')
const { ResultData, ResultFault } = require('../../response')
const { Info } = require('../../model/fs/info')
const { FsContext } = require('../../app').Context

/**
 * 文件管理控制器
 */
class BaseCtrl extends Ctrl {
  constructor(...args) {
    super(...args)
  }
  /**
   * 检查访问权限
   */
  async tmsBeforeEach() {
    if (!FsContext.insSync) throw new ResultFault('文件服务不可用')
    this.fsContext = FsContext.insSync()

    let { domain } = this.request.query
    if (domain) {
      if (!this.fsContext.isValidDomain(domain))
        throw new ResultFault(`指定的参数domain=${domain}不可用`)
      this.domain = domain
    } else {
      this.domain = this.fsContext.defaultDomain
    }

    this.bucket = await this.fsContext.getClientBucket(
      this.client,
      this.domain,
      this.request
    )

    const { path } = this.request.query
    if (path) {
      const result = await this.fsContext.checkClientACL(
        this.client,
        this.domain,
        this.bucket,
        path,
        this.request
      )
      if (result !== true)
        return new ResultFault('没有访问指定目录或文件的权限')
    }

    return true
  }
  /**
   * 返回扩展信息定义
   */
  async schemas() {
    const fsInfo = await Info.ins()
    if (!fsInfo) return new ResultFault('不支持设置文件信息')

    let schemas = fsInfo.schemas

    return new ResultData(schemas)
  }
  /**
   * 设置上传文件信息
   */
  async setInfo() {
    const fsInfo = await Info.ins()
    if (!fsInfo) return new ResultFault('不支持设置文件信息')

    const { path } = this.request.query
    const info = this.request.body
    info.userid = this.client ? this.client.id : ''

    fsInfo.set(path, info)

    return new ResultData('ok')
  }
}
module.exports = { BaseCtrl, ResultData }
