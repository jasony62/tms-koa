const { UploadCtrl } = require('../../../lib/controller/fs/upload')

class Upload extends UploadCtrl {
  constructor(...args) {
    super(...args)
  }
}

module.exports = Upload
