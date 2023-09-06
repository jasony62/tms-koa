/**
 * 消息推送服务
 */
import path from 'path'
import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'
import { loadConfig } from 'tms-koa'

import { getLogger } from '@log4js-node/log4js-api'
const logger = getLogger('tms-koa-account')

export class Context {
  static init
  static ins
  static insSync
  dbFile

  constructor(dbFile) {
    this.dbFile = dbFile
  }

  getDBSync() {
    const adapter = new JSONFile(this.dbFile)
    const db = new Low(adapter, {})
    return db
  }
}

Context.init = (function () {
  let _instance
  return function (lowdbConfig) {
    if (_instance) return _instance

    if (!lowdbConfig) {
      lowdbConfig = loadConfig('lowdb', { captchas: [] })
    }

    if (!lowdbConfig.file) {
      lowdbConfig.file = '_lowdb.json'
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
