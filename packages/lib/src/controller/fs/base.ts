import { Ctrl } from '../ctrl.js'
import { ResultData, ResultFault } from '../../response.js'
import { LocalFS, MinioFS, Info } from '../../model/fs/index.js'

import fs from 'fs'
import crypto from 'crypto'
import log4js from '@log4js-node/log4js-api'

const logger = log4js.getLogger('tms-koa-fs-base')

/**
 * 文件管理控制器
 */
export class BaseCtrl extends Ctrl {
  domain

  constructor(ctx, client, dbContext, mongoClient, pushContext, fsContext) {
    super(ctx, client, dbContext, mongoClient, pushContext, fsContext)
  }
  /**
   * 根据配置文件，提供文件服务模型实例
   * @returns
   */
  protected fsModel() {
    if (this.fsContext.minioClient)
      return new MinioFS(this.tmsContext, this.domain, this.bucket)
    else return new LocalFS(this.tmsContext, this.domain, this.bucket)
  }
  /**
   * 检查访问权限
   */
  async tmsBeforeEach() {
    if (!this.fsContext) return new ResultFault('文件服务不可用')

    let { domain } = this.request.query
    // 检查指定的domain
    if (domain) {
      if (!this.fsContext.isValidDomain(domain))
        return new ResultFault(`指定的参数domain=${domain}不可用`)
      this.domain = this.fsContext.getDomain(domain)
    } else {
      this.domain = this.fsContext.getDomain(this.fsContext.defaultDomain)
    }

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
    if (!this.domain.schemas)
      return new ResultData({ schemas: null, schemasRootName: '' })

    let { schemas, schemasRootName } = this.domain
    return new ResultData({ schemas, schemasRootName })
  }
  /**
   * 设置上传文件信息
   */
  async setInfo() {
    const { domain, bucket } = this

    const fsInfo = await Info.ins(domain)
    if (!fsInfo) return new ResultFault('不支持设置文件信息')

    const { path, setMD5 = 'N' } = this.request.query
    if (!path) return new ResultFault('未指定文件路径')

    // 检查path是否在指定的空间下
    // let space = domain.name
    // if (bucket) space += `/${bucket}`
    // if (!new RegExp(space).test(path)) {
    //   return new ResultFault('没有修改当前文件信息的权限')
    // }

    const info = this.request.body
    info.userid = this.client ? this.client.id : ''
    if (bucket) info.bucket = bucket

    this._setFileInfo(fsInfo, path, info, setMD5)

    return new ResultData('ok')
  }
  /**
   *
   */
  async _setFileInfo(fsInfo, path, info, setMD5 = 'N') {
    if (setMD5 === 'Y') {
      const PATH = await import('path')
      let md5 = await this.getFileMD5(PATH.join(this.fsContext.rootDir, path))
      if (md5 !== false) info.md5 = md5
    }

    return await fsInfo.set(path, info)
  }
  /**
   * 文件生成md5
   */
  async getFileMD5(path) {
    //
    if (!fs.existsSync(path)) {
      logger.error('getFileMD5: ', path, ' 未找到指定文件')
      return Promise.resolve(false)
    }
    // 生成md5
    return new Promise((resolve) => {
      const hash = crypto.createHash('md5')
      const input = fs.createReadStream(path)
      let startTime = new Date().getTime()
      input.on('error', (err) => {
        logger.error('getFileMD5', path, err)
        return resolve(false)
      })
      input.on('data', (data) => {
        hash.update(data)
      })
      input.on('end', () => {
        let fileMD5 = hash.digest('hex')
        logger.debug(
          '文件:' +
            path +
            ',MD5签名为:' +
            fileMD5 +
            '.耗时:' +
            (new Date().getTime() - startTime) / 1000.0 +
            '秒'
        )
        return resolve(fileMD5)
      })
    })
  }
  /**
   * 批量设置上传文件信息
   */
  async setInfos() {
    const { domain, bucket } = this
    const fsInfo = await Info.ins(domain)
    if (!fsInfo) return new ResultFault('不支持设置文件信息')

    const { setMD5 = 'N' } = this.request.query
    const files = this.request.body
    if (!Array.isArray(files) || files.length === 0)
      return new ResultFault('未指定文件')

    let space = domain.name
    if (bucket) space += `/${bucket}`
    for (const file of files) {
      // 检查path是否在指定的空间下
      if (!new RegExp(space).test(file.path)) {
        logger.debug('setInfos', file.path + ' 没有修改当前文件信息的权限')
        continue
      }

      let info = file.info || {}
      info.userid = this.client ? this.client.id : ''
      if (bucket) info.bucket = bucket

      this._setFileInfo(fsInfo, file.path, info, setMD5)
    }

    return new ResultData('ok')
  }
}
