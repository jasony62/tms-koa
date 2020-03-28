const { Ctrl, ResultData } = require('../../lib/app')

class Main extends Ctrl {
  /**
   * 检查请求是否来源于可信主机，跳过鉴权机制
   */
  static tmsAuthTrustedHosts() {
    return true
  }
  tryGet() {
    let { value } = this.request.query

    return new ResultData(`收到：${value}`)
  }
}

module.exports = Main
