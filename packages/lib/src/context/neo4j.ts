const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-koa-neo4j')
const neo4j = require('neo4j-driver')

class Neo4jConfig {
  host: string
  port: number
  user: string
  password: string

  constructor(config: object) {
    this.host = config['host']
    this.port = config['port']
    this.user = config['user']
    this.password = config['password']
  }
}

class Context {
  private static _instancesByUri = new Map()
  private static _instancesByName = new Map()

  private _name
  private _driver

  constructor(name, driver) {
    this._name = name
    this._driver = driver
  }
  async session() {
    return await this._driver.session()
  }
  async close() {
    logger.info(`开始关闭连接[${this._name}]`)
    let prom = await this._driver.close()
    logger.info(`完成关闭连接[${this._name}]`)
    return prom
  }

  /**
   * 获得连接实例
   * @param config Neo4jConfig | string
   * @param name? string
   * @returns
   */
  static async ins(
    config?: Neo4jConfig | string,
    name?: string
  ): Promise<Context> {
    if (config === undefined) {
      return Context._instancesByName.get('master')
    }
    if (typeof config === 'string' && undefined === name) {
      return Context._instancesByName.get(config)
    }
    if (config instanceof Neo4jConfig) {
      let { host, port, user, password } = config
      if (typeof host !== 'string') {
        let msg = '没有指定neo4j的主机地址'
        logger.error(msg)
        throw Error(msg)
      }
      if (typeof port !== 'number') {
        let msg = '没有指定neo4j连接的端口'
        logger.error(msg)
        throw Error(msg)
      }
      if (user && typeof user !== 'string') {
        let msg = '没有指定neo4j的用户名'
        logger.error(msg)
        throw Error(msg)
      }
      if (password && typeof password !== 'string') {
        let msg = '没有指定neo4j的密码'
        logger.error(msg)
        throw Error(msg)
      }

      let uri = `neo4j://${host}:${port}`
      logger.debug('开始连接[%s]', uri)
      const driver = neo4j.driver(uri, neo4j.auth.basic(user, password))
      logger.debug('完成连接[%s]', uri)

      let ins = new Context(name, driver)

      Context._instancesByUri.set(uri, ins)
      Context._instancesByName.set(name, ins)

      return ins
    }

    throw Error(`参数类型错误：${typeof config}`)
  }
  /**
   * 按照配置文件进行初始化
   * @param config object
   */
  static async init(config: object) {
    if (!config || typeof config !== 'object') {
      let msg = '没有指定连接neo4j配置信息'
      logger.error(msg)
      throw Error(msg)
    }

    if (config['diabled'] === true) {
      return {}
    }

    const names = Object.keys(config).filter((n) => n !== 'disabled')
    if (names.length === 0) {
      let msg = '指定连接neo4j配置信息为空'
      logger.error(msg)
      throw Error(msg)
    }

    let instances
    if (names.includes('host') && names.includes('port')) {
      instances = [await Context.ins(new Neo4jConfig(config), 'master')]
    } else {
      instances = await Promise.all(
        names.map((name) => Context.ins(new Neo4jConfig(config[name]), name))
      )
    }

    return instances
  }
  /**
   * 关闭所有连接
   */
  static async close() {
    let instances = [...Context._instancesByName.values()]
    return await Promise.all(instances.map((ins) => ins.close()))
  }
}

export { Neo4jConfig, Context }
