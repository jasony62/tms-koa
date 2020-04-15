const { Ctrl, ResultData } = require('tms-koa')

class Main extends Ctrl {
  tmsRequireTransaction() {
    return {
      get: true,
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
  tryPush() {
    if (this.socket) {
      setTimeout(() => {
        console.log('xxxxxxxx')
        this.socket.emit('tms-koa-controller', { result: 'push in tryPush()' })
      }, 1000)
    }
    return new ResultData('ok')
  }
}
module.exports = Main
