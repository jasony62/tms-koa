const { BaseCtrl } = require('./base')
const { ResultData, ResultFault } = require('../../response')
const { UploadPlain } = require('../../model/fs/upload')
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
  plain() {
    if (!this.request.files || !this.request.files.file) {
      return new ResultFault('没有上传文件')
    }

    const file = this.request.files.file
    const upload = new UploadPlain()
    const filepath = upload.store(file)

    return new ResultData(filepath)
  }
}
module.exports = { UploadCtrl, ResultData }
