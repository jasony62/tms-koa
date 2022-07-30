const { UploadCtrl } = require('tms-koa/dist/controller/fs/upload')

class Upload extends UploadCtrl {
  static tmsAccessWhite() {
    return ['plain']
  }
}

module.exports = Upload
