/* eslint-disable require-atomic-updates */
const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-koa-fs')
const fs = require('fs')

class Context {
  constructor(rootDir) {
    this.rootDir = rootDir
  }
}
Context.init = (function() {
  let _instance

  return async function(fsConfig) {
    if (_instance) return _instance

    if (typeof fsConfig.local !== 'object') {
      logger.warn(`文件服务配置文件中没有指定本地文件服务信息`)
      return false
    }
    const lfsConfig = fsConfig.local
    if (typeof lfsConfig.database !== 'object') {
      logger.warn(`文件服务配置文件中没有指定数据库`)
      return false
    }
    if (typeof lfsConfig.schemas !== 'object') {
      logger.warn(`文件服务配置文件中指定的扩展信息定义不是对象`)
      return false
    }
    // 本地文件存储起始位置
    const rootDir = lfsConfig.rootDir.replace(/\/$/, '') // 如果有替换掉结尾的斜杠
    _instance = new Context(rootDir)

    // 数据库设置，保存文件信息
    let fsDbConfig = lfsConfig.database
    if (fsDbConfig) {
      if (typeof fsDbConfig.dialect !== 'string' || !fsDbConfig.dialect) {
        logger.warn(`文件服务配置文件中[dialect]参数不可用`)
        return false
      }
      if (typeof fsDbConfig.source !== 'string' || !fsDbConfig.source) {
        logger.error(`文件服务配置文件中[source]参数不可用`)
        return false
      }
      // 扩展信息设置
      let fsSchemas = lfsConfig.schemas
      const { source } = fsDbConfig
      const MongoContext = require('./mongodb').Context
      const mongoClient = await MongoContext.mongoClient(source)
      if (!mongoClient) {
        logger.error(`文件服务配置文件中指定的mongodb[${source}]不可用`)
        return false
      }
      if (typeof fsDbConfig.database !== 'string' || !fsDbConfig.database) {
        logger.error(`文件服务配置文件中指定[database]不可用`)
        return false
      }
      if (
        typeof fsDbConfig.file_collection !== 'string' ||
        !fsDbConfig.file_collection
      ) {
        logger.error(`文件服务配置文件中指定[file_collection]不可用`)
        return false
      }
      _instance.mongoClient = mongoClient
      _instance.database = fsDbConfig.database
      _instance.collection = fsDbConfig.file_collection
      _instance.schemas = fsSchemas
    }
    // 访问控制
    const { accessControl } = lfsConfig
    if (accessControl && accessControl.module) {
      if (fs.existsSync(accessControl.module)) {
        const validator = require(accessControl.module)
        if (typeof validator === 'function') {
          _instance.aclValidator = validator
        }
      }
    }

    Context.insSync = function() {
      return _instance
    }

    logger.info(`完成文件服务设置。`)

    return _instance
  }
})()

Context.ins = Context.init

module.exports = { Context }
