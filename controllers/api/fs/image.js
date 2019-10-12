const { ImageCtrl } = require('../../../lib/controller/fs/imageage')

class Image extends ImageCtrl {
  constructor(request, client, db) {
    super(request, client, db)
  }
}

module.exports = Image
