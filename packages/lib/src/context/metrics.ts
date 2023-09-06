/** @module context/metrics */
/* eslint-disable require-atomic-updates */
import log4js from '@log4js-node/log4js-api'
import PromClient from 'prom-client'

const logger = log4js.getLogger('tms-koa-metrics')

let _instance

/** swagger服务配置信息 */
export class Context {
  private _register
  /**
   * 创建上下文
   *
   * @param {Object} register - 监控指标注册器
   */
  constructor(register) {
    this._register = register
  }
  get client() {
    return PromClient
  }
  get register() {
    return this._register
  }
  /**
   * 获得配置信息实例
   *
   * @return {Context} 配置信息实例.
   */
  static async init(metricsConfig) {
    if (_instance) return _instance

    // const register = new Registry()
    const { register } = PromClient

    let { collectDefault } = metricsConfig

    if (collectDefault === true) {
      let msg = '提供默认系统监控指标'
      logger.info(msg)
      const collectDefaultMetrics = PromClient.collectDefaultMetrics
      collectDefaultMetrics({ register })
    }

    _instance = new Context(register)

    logger.info(`完成监控服务设置。`)

    return _instance
  }

  static insSync() {
    return _instance
  }

  static ins = Context.init
}
