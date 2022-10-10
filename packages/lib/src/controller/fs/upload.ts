import { BaseCtrl } from './base'
import { ResultData, ResultFault } from '../../response'
import { UploadPlain, Info, LocalFS } from '../../model/fs'
import * as fs from 'fs'

/**
 * 文件管理控制器（上传）
 */
export class UploadCtrl extends BaseCtrl {
  /**
   * 表单方式上传单个文件
   */
  async plain() {
    if (!this.request.files?.file) return new ResultFault('没有上传文件')

    // 指定的文件存储目录，如果不指定按时间自动生成目录
    const { dir, forceReplace, thumb } = this.request.query

    // 上传的原始文件，由formidable定义
    const { file } = this.request.files

    const tmsFs = new LocalFS(this.tmsContext, this.domain, this.bucket)
    const uploader = new UploadPlain(tmsFs)
    try {
      const filepath = await uploader.store(file, dir, forceReplace)

      let thumbInfo
      if (thumb === 'Y') {
        if (
          this?.fsContext?.thumbnail &&
          typeof this.fsContext.thumbnail === 'object'
        ) {
          thumbInfo = await uploader.makeThumb(filepath, false)
        } else {
          return new ResultFault('未设置缩略图服务，无法创建缩略图')
        }
      }

      const publicPath = uploader.publicPath(filepath)

      let result: any = { path: publicPath, size: file.size }
      if (thumbInfo) {
        result.thumbPath = thumbInfo.path
        result.thumbSize = thumbInfo.size
      }

      /**在数据库中记录文件信息*/
      const fsInfo = await Info.ins(this.domain)
      if (fsInfo) {
        const info = this.request.body
        info.userid = this.client ? this.client.id : ''
        info.bucket = this.bucket
        info.name = file.originalFilename
        info.type = file.mimetype
        info.size = file.size
        info.lastModified = file.lastModifiedDate
          ? file.lastModifiedDate.getTime()
          : Date.now()
        if (thumbInfo) {
          info.thumbPath = thumbInfo.path
          info.thumbSize = thumbInfo.size
          info.thumbType = info.type
        }
        /**用户自定义的扩展信息*/
        const { schemasRootName } = this.domain
        if (schemasRootName) {
          let extraInfo = this.request.files[schemasRootName]
          if (extraInfo && extraInfo.mimetype === 'application/json') {
            let data = fs.readFileSync(extraInfo.filepath, 'utf-8')
            data = JSON.parse(data)
            info[schemasRootName] = data
          }
        }

        fsInfo.set(publicPath, info)
      }

      return new ResultData(result)
    } catch (e) {
      return new ResultFault(e.message)
    }
  }
}
