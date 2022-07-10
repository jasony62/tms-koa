import { UploadCtrl } from './upload'
import { ResultData, ResultFault } from '../../response'

const { LocalFS } = require('../../model/fs/local')
const { Info } = require('../../model/fs/info')
const { UploadImage } = require('../../model/fs/upload')
const fs = require('fs-extra')

/**
 * 文件管理控制器
 */
export class ImageCtrl extends UploadCtrl {
  /**
   * 上传Base64格式的文件
   */
  async uploadBase64() {
    const contentType = this.ctx.header['content-type']
    const { dir, forceReplace, base64Field, thumb } = this.request.query
    const { body } = this.request

    const tmsFs = new LocalFS(this.domain, this.bucket)

    let upload = new UploadImage(tmsFs)

    let base64Content
    if (contentType === 'text/plain') {
      base64Content = body
    } else if (contentType === 'application/json') {
      if (!base64Field) return new ResultFault('没有指定base64数据字段名')
      base64Content = body[base64Field]
    } else {
      return new ResultFault('不支持的内容类型')
    }

    try {
      const filepath = upload.storeBase64(base64Content, dir, forceReplace)
      const publicPath = upload.publicPath(filepath)
      if (contentType === 'application/json') {
        const fsInfo = await Info.ins(this.domain)
        if (fsInfo) {
          const info = this.request.body
          delete info[base64Field]
          info.userid = this.client ? this.client.id : ''
          info.bucket = this.bucket

          fsInfo.set(publicPath, info)
        }
      }

      // 获取文件信息
      let stat = fs.statSync(filepath)
      let result: any = { path: publicPath, size: stat.size }
      if (thumb === 'Y') {
        let thumbInfo = await upload.makeThumb(filepath, false)
        result.thumbPath = thumbInfo.path
        result.thumbSize = thumbInfo.size
      }

      return new ResultData(result)
    } catch (e) {
      return new ResultFault(e.message)
    }
  }
}
