import { BaseCtrl } from './base'
import { ResultData, ResultFault } from '../../response'
import { UploadPlain, Info, LocalFS } from '../../model/fs'

/**
 * 文件管理控制器（上传）
 */
export class UploadCtrl extends BaseCtrl {
  /**
   * 上传单个文件
   */
  async plain() {
    if (!this.request.files?.file) return new ResultFault('没有上传文件')

    // 指定的文件存储目录，如果不指定按时间自动生成目录
    const { dir, forceReplace, thumb } = this.request.query

    // 上传的原始文件，由formidable定义
    const { file } = this.request.files

    const tmsFs = new LocalFS(this.domain, this.bucket)
    const uploader = new UploadPlain(tmsFs)
    try {
      const filepath = await uploader.store(file, dir, forceReplace)

      let thumbInfo
      if (thumb === 'Y') {
        thumbInfo = await uploader.makeThumb(filepath, false)
      }

      const publicPath = uploader.publicPath(filepath)
      const fsInfo = await Info.ins(this.domain)
      if (fsInfo) {
        const info = this.request.body
        info.userid = this.client ? this.client.id : ''
        info.bucket = this.bucket

        fsInfo.set(publicPath, info)
      }

      let result: any = { path: publicPath, size: file.size }
      if (thumbInfo) {
        result.thumbPath = thumbInfo.path
        result.thumbSize = thumbInfo.size
      }

      return new ResultData(result)
    } catch (e) {
      return new ResultFault(e.message)
    }
  }
}
