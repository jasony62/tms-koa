const { Ctrl, ResultData } = require('../../lib/app')

class Main extends Ctrl {
  tmsRequireTransaction() {
    return {
      get: true
    }
  }
  tryGet() {
    let { value } = this.request.query

    return new ResultData(`收到：${value}`)
  }
  tryPost() {
    let posted = this.request.body

    return new ResultData(posted)
  }
}
module.exports = Main
