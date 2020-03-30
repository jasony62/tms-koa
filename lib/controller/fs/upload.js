const { BaseCtrl } = require('./base')
const { ResultData, ResultFault } = require('../../response')
const { UploadPlain } = require('../../model/fs/upload')
const { Info } = require('../../model/fs/info')
const { LocalFS } = require('../../model/fs/local')
/**
 * 文件管理控制器（上传）
 */
class UploadCtrl extends BaseCtrl {
  constructor(...args) {
    super(...args)
  }
  /**
   * 上传单个文件
   */
  async plain() {
    if (!this.request.files || !this.request.files.file) {
      return new ResultFault('没有上传文件')
    }
    // 指定的文件存储目录，如果不指定按时间自动生成目录
    const { dir, forceReplace } = this.request.query

    const tmsFs = new LocalFS(this.domain, this.bucket)

    const file = this.request.files.file
    const upload = new UploadPlain(tmsFs)
    try {
      const filepath = await upload.store(file, dir, forceReplace)
      const publicPath = upload.publicPath(filepath)
      const fsInfo = await Info.ins(this.domain)
      if (fsInfo) {
        const info = this.request.body
        info.userid = this.client ? this.client.id : ''
        info.bucket = this.bucket

        fsInfo.set(publicPath, info)
      }

      return new ResultData(publicPath)
    } catch (e) {
      return new ResultFault(e.message)
    }
  }
}
module.exports = { UploadCtrl, ResultData }
