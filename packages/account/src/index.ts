import { ResultData } from 'tms-koa'
import * as crypto from 'tms-koa-crypto'

import authenticate from './models/authenticate.js'
import register from './models/register.js'
import processPwd from './models/processpwd.js'

class Main {
  /**
   * 保存测试流
   */
  version() {
    let pkg = require(__dirname + '/package.json')
    return new ResultData(pkg.version)
  }
}

export { Main, authenticate, register, processPwd, crypto }
