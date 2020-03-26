const { DownloadCtrl } = require('../../../lib/controller/fs/download')

class Download extends DownloadCtrl {
  constructor(...args) {
    super(...args)
  }
}

module.exports = Download