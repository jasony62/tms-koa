const { BrowseCtrl } = require('tms-koa/lib/controller/fs/browse')

class Browse extends BrowseCtrl {
  constructor(...args) {
    super(...args)
  }
}

module.exports = Browse
