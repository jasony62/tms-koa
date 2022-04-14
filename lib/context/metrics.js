/** @module context/metrics */
/* eslint-disable require-atomic-updates */
const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-koa-metrics')
const PromClient = require('prom-client')
const { Registry } = PromClient

const { ProfileCollector } = require('../metrics/collector/mongodb/profile')

async function startSystemProfile(config) {
  let { db, prefix } = config
  if (!db || typeof db !== 'string') {
    logger.warn(`监控服务配置文件中,未指定参数db，或数据类型不是字符串`)
    return false
  }

  /* 启用mongodb慢查询监控指标 */
  const { MongoContext } = require('../app').Context
  if (MongoContext) {
    const mongoClient = await MongoContext.mongoClient()
    const pc = new ProfileCollector(mongoClient, db, prefix)
    pc.run()
  }
}

/** swagger服务配置信息 */
class Context {
  /**
   * 创建上下文
   *
   * @param {Object} register - 监控指标注册器
   */
  constructor(register) {
    this.register = register
  }
}

Context.init = (function () {
  let _instance
  /**
   * 获得配置信息实例
   *
   * @return {Context} 配置信息实例.
   */
  return async function (metricsConfig) {
    if (_instance) return _instance

    const register = new Registry()

    let { collectDefault, systemProfile } = metricsConfig

    if (collectDefault === true) {
      let msg = '提供默认系统监控指标'
      logger.info(msg)
      const collectDefaultMetrics = PromClient.collectDefaultMetrics
      collectDefaultMetrics({ register })
    }

    _instance = new Context(register)

    Context.insSync = function () {
      return _instance
    }

    /* 启动监控system.profile */
    if (systemProfile) {
      if (Array.isArray(systemProfile)) {
        systemProfile.forEach((config) => startSystemProfile(config))
      } else if (typeof systemProfile === 'object') {
        startSystemProfile(systemProfile)
      }
    }

    logger.info(`完成监控服务设置。`)

    return _instance
  }
})()

Context.ins = Context.init

module.exports = { Context }
