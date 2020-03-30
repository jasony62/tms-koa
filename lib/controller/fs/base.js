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
    if (!FsContext.insSync) return new ResultFault('文件服务不可用')
    this.fsContext = FsContext.insSync()

    let { domain, bucket } = this.request.query
    // 检查指定的domain
    if (domain) {
      if (!this.fsContext.isValidDomain(domain))
        return new ResultFault(`指定的参数domain=${domain}不可用`)
      this.domain = this.fsContext.getDomain(domain)
    } else {
      this.domain = this.fsContext.getDomain(this.fsContext.defaultDomain)
    }

    // 检查指定的bucket
    const bucketResult = await this.fsContext.checkClientBucket(
      this.client,
      this.domain,
      bucket,
      this.request
    )
    if (!Array.isArray(bucketResult))
      return new ResultFault(`检查bucket回调函数返回类型错误`)
    if (true !== bucketResult[0]) {
      if (undefined === bucket) return new ResultFault(`没有指定bucket参数`)
      else return new ResultFault(`指定的参数bucket=${bucket}不可用`)
    }
    if (undefined === bucket && typeof bucketResult[1] === 'string') {
      bucket = bucketResult[1]
    }
    this.bucket = bucket === undefined ? '' : bucket

    // 检查文件访问权限
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
    if (!this.domain.schemas) return new ResultFault('没有设置文件扩展信息定义')

    return new ResultData(this.domain.schemas)
  }
  /**
   * 设置上传文件信息
   */
  async setInfo() {
    const { domain, bucket } = this

    const fsInfo = await Info.ins(domain)
    if (!fsInfo) return new ResultFault('不支持设置文件信息')

    const { path } = this.request.query

    // 检查path是否在指定的空间下
    let space = domain.name
    if (bucket) space += `/${bucket}`
    if (!new RegExp(space).test(path)) {
      return new ResultFault('没有修改当前文件信息的权限')
    }

    const info = this.request.body
    info.userid = this.client ? this.client.id : ''
    if (bucket) info.bucket = bucket

    fsInfo.set(path, info)

    return new ResultData('ok')
  }
}
module.exports = { BaseCtrl, ResultData }
