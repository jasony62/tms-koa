/** @module context/swagger */
/* eslint-disable require-atomic-updates */
const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-koa-swagger')

/** swagger服务配置信息 */
class Context {
  /**
   * 创建上下文
   * @param {Object} definition - 服务定义
   * @param {string[]} apis - 包含API的文件
   */
  constructor(definition, apis) {
    this.definition = definition
    this.apis = apis
  }
}

Context.init = (function () {
  let _instance
  /**
   * 获得配置信息实例
   * @param {Object} [swaggerConfig] - 配置文件中指定的内容.
   * @return {Context} 配置信息实例.
   */
  return async function (swaggerConfig) {
    if (_instance) return _instance

    let { definition, apis } = swaggerConfig

    if (!definition || !definition.info) {
      let msg = '配置文件中没有指定[definition.info]字段'
      logger.error(msg)
      throw new Error(msg)
    }
    let { info } = definition
    ;['title', 'version'].forEach((field) => {
      if (!info[field]) {
        let msg = `配置文件中没有指定[definition.info.${field}]字段`
        logger.error(msg)
        throw new Error(msg)
      }
    })

    if (!Array.isArray(apis)) {
      logger.warn(`没有指定有效的API代码路径，设置为默认路径`)
      apis = ['./controllers/**/*.js']
    }

    _instance = new Context(definition, apis)

    Context.insSync = function () {
      return _instance
    }

    logger.info(`完成Swagger服务设置。`)

    return _instance
  }
})()

Context.ins = Context.init

module.exports = { Context }
