const { UploadCtrl } = require('tms-koa/lib/controller/fs/upload')

class Upload extends UploadCtrl {
  constructor(...args) {
    super(...args)
  }
}

module.exports = Upload
