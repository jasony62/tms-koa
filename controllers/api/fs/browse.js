const { BrowseCtrl } = require('../../../lib/controller/fs/browse')

class Browse extends BrowseCtrl {
  constructor(request, client, db) {
    super(request, client, db)
  }
}

module.exports = Browse
