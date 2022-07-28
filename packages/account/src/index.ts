const { ResultData } = require('./models/response')
const authenticate = require('./models/authenticate')
const captcha = require('./models/captcha')
const register = require('./models/register')
const processPwd = require('./models/processpwd')
const crypto = require('./models/crypto')

class Main {
  /**
   * 保存测试流
   */
  version() {
    let pkg = require(__dirname + '/package.json')
    return new ResultData(pkg.version)
  }
}

export { Main, authenticate, captcha, register, processPwd, crypto }
