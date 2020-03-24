const { BaseCtrl } = require('./base')
const { ResultData, ResultFault } = require('../../response')
const { UploadPlain } = require('../../model/fs/upload')
const { Info } = require('../../model/fs/info')
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

    const { LocalFS } = require('./local')
    const tmsFs = new LocalFS(this.domain, this.bucket)

    const file = this.request.files.file
    const upload = new UploadPlain(tmsFs)
    const filepath = await upload.store(file)

    const info = this.request.body
    info.userid = this.client ? this.client.id : ''

    const mlInfo = await Info.ins()
    mlInfo.set(filepath, info)

    return new ResultData(filepath)
  }
}
module.exports = { UploadCtrl, ResultData }
