const { ImageCtrl } = require('tms-koa/lib/controller/fs/image')

class Image extends ImageCtrl {
  constructor(...args) {
    super(...args)
  }
}

module.exports = Image
