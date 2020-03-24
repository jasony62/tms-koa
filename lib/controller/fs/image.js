const { UploadCtrl } = require('./upload')
const { ResultData } = require('../../response')
const { UploadImage } = require('../../model/fs/upload')
/**
 * 文件管理控制器
 */
class ImageCtrl extends UploadCtrl {
  constructor(...args) {
    super(...args)
  }
  /**
   * 上传Base64格式的文件
   */
  uploadBase64() {
    let { body } = this.request

    const { LocalFS } = require('./local')
    const tmsFs = new LocalFS(this.domain, this.bucket)

    let upload = new UploadImage(tmsFs)
    let fullname = upload.storeBase64(body)

    return new ResultData(fullname)
  }
}
module.exports = { ImageCtrl, ResultData }
