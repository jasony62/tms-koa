/** @module context/swagger */
/* eslint-disable require-atomic-updates */
const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-koa-swagger')

let _instance

/** swagger服务配置信息 */
export class Context {
  definition
  apis
  /**
   * 创建上下文
   * @param {Object} definition - 服务定义
   * @param {string[]} apis - 包含API的文件
   */
  constructor(definition, apis) {
    this.definition = definition
    this.apis = apis
  }
  /**
   * 获得配置信息实例
   *
   * @param {Object} [swaggerConfig] - 配置文件中指定的内容.
   *
   * @return {Context} 配置信息实例.
   */
  static async init(swaggerConfig) {
    if (_instance) return _instance

    let { definition, apis } = swaggerConfig

    if (!definition) {
      let msg = '配置文件中没有指定[definition]字段'
      logger.error(msg)
      throw new Error(msg)
    }
    if (!definition.info) {
      let msg = '配置文件中没有指定[definition.info]字段'
      logger.error(msg)
      throw new Error(msg)
    }

    let { info, servers } = definition
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

    let swaggerDef: any = {}
    /** 设置规范版本 */
    if (definition.openapi) {
      swaggerDef.openapi = definition.openapi
    } else if (definition.swagger) {
      swaggerDef.swagger = definition.swagger
    } else {
      swaggerDef.openapi = process.env.TMS_KOA_OAS_VERSION || '3.0.0'
    }
    swaggerDef.info = info
    swaggerDef.servers = servers

    _instance = new Context(swaggerDef, apis)

    logger.info(`完成Swagger服务设置。`)

    return _instance
  }

  static insSync() {
    return _instance
  }

  static ins = Context.init
}
