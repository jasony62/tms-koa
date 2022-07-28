/**
 * 消息推送服务
 */
const path = require('path')
const low = require('lowdb')
const fileSync = require('lowdb/adapters/FileSync')

const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-koa-account-lowdb')

export class Context {
  static init
  static ins
  static insSync
  dbFile

  constructor(dbFile) {
    this.dbFile = dbFile
  }

  getDBSync() {
    const adapter = new fileSync(this.dbFile)
    const db = new low(adapter)
    return db
  }
}

Context.init = (function () {
  let _instance
  return function (lowdbConfig) {
    if (_instance) return _instance

    if (!lowdbConfig) {
      const { loadConfig } = require("../config")
      lowdbConfig = loadConfig('lowdb', {})
    }

    if (!lowdbConfig.file) {
      lowdbConfig.file = "_lowdb.json"
    }

    let dbFile = path.resolve(lowdbConfig.file)

    _instance = new Context(dbFile)

    Context.insSync = function () {
      return _instance
    }

    logger.info(`完成lowdb服务设置`)

    return _instance
  }
})()

Context.ins = Context.init
