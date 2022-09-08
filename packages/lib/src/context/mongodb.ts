const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-koa-mongodb')
const { MongoClient, MongoError } = require('mongodb')
const Debug = require('debug')

const debug = Debug('tms-koa:mongodb:context')

class TmsMongoDb {
  _mongoClient
  _url

  constructor(mongoClient, url) {
    this._mongoClient = mongoClient
    this._url = url
  }

  get mongoClient() {
    return this._mongoClient
  }

  get url() {
    return this._url
  }

  static connect(url) {
    return MongoClient.connect(url, {
      useUnifiedTopology: true,
      keepAliveInitialDelay: 1,
    })
      .then((client) => client)
      .catch((err) => {
        const msg = `连接[${url}]失败：${err.message}`
        logger.error(msg)
        return Promise.reject(new MongoError(msg))
      })
  }
}

let _instancesByUrl = new Map()
let _instancesByName = new Map()

/**
 * mongodb连接管理
 */
export class Context {
  /**
   * 按照配置文件进行初始化
   */
  static async init(config) {
    if (!config || typeof config !== 'object') {
      let msg = '没有指定连接mongodb配置信息'
      logger.error(msg)
      throw new MongoError(msg)
    }
    const names = Object.keys(config)
    if (names.length === 0) {
      let msg = '指定连接mongodb配置信息为空'
      logger.error(msg)
      throw new MongoError(msg)
    }
    let instances
    if (names.includes('host') && names.includes('port')) {
      instances = [await Context.ins(config, 'master')]
    } else {
      instances = await Promise.all(
        names
          .filter((n) => n !== 'disabled')
          .map((name) => Context.ins(config[name], name))
      )
    }

    return instances
  }

  static async ins(config, name?) {
    if (typeof config === 'string' && undefined === name) {
      return _instancesByName.get(config)
    }

    let { host, port, replicaSet, user, password, authSource, maxPoolSize } =
      config
    if (
      undefined === host &&
      undefined === port &&
      _instancesByUrl.size === 1
    ) {
      return _instancesByUrl.values().next().value
    }
    if (replicaSet && typeof replicaSet !== 'string') {
      let msg = '参数replicaSet类型错误'
      logger.error(msg)
      throw new MongoError(msg)
    }
    if (replicaSet) {
      if (!Array.isArray(host) || host.length === 0) {
        let msg = '没有指定mongodb的主机地址'
        logger.error(msg)
        throw new MongoError(msg)
      }
      if (!Array.isArray(port) || port.length === 0) {
        let msg = '没有指定mongodb连接的端口'
        logger.error(msg)
        throw new MongoError(msg)
      }
      if (host.length !== port.length) {
        let msg = '指定的mongodb连接参数host和port数量不匹配'
        logger.error(msg)
        throw new MongoError(msg)
      }
    } else {
      if (typeof host !== 'string') {
        let msg = `没有指定mongodb的主机地址[host=${host}]`
        logger.error(msg)
        throw new MongoError(msg)
      }
    }

    let url = ''
    if (replicaSet) {
      if (Array.isArray(host))
        host.forEach((h, i) => {
          if (i > 0) url += ','
          url += `${h}`
          if (typeof port[i] === 'number') url += `:${port[i]}`
        })
      url += `/?replicaSet=${replicaSet}`
    } else {
      url = `${host}`
      if (typeof port === 'number') url += `:${port}`
    }
    if (
      user &&
      typeof user === 'string' &&
      password &&
      typeof password === 'string'
    ) {
      url = `mongodb://${user}:${password}@${url}`
    } else {
      url = `mongodb://${url}`
    }

    if (authSource) {
      if (url.indexOf('?') !== -1) url += `&authSource=${authSource}`
      else url += `?authSource=${authSource}`
    }
    if (maxPoolSize) {
      if (url.indexOf('?') !== -1) url += `&maxPoolSize=${maxPoolSize}`
      else url += `?maxPoolSize=${maxPoolSize}`
    }

    if (_instancesByUrl.has(url)) return _instancesByUrl.get(url)

    logger.debug('开始连接[%s]', url)
    debug(`开始连接[${url}]`)
    const client = await TmsMongoDb.connect(url)
    logger.debug('完成连接[%s]', url)
    debug(`完成连接[${url}]`)

    let instance = new TmsMongoDb(client, url)

    _instancesByUrl.set(url, instance)
    _instancesByName.set(name, instance)

    return Promise.resolve(instance)
  }
  static insSync(name) {
    return _instancesByName.get(name)
  }
  /**
   *
   * @param {string} name 数据源的名称
   */
  static async mongoClient(name = 'master') {
    const ins = await Context.ins(name)
    if (!ins) throw new Error(`无法获得mongodb[${name}]连接实例`)
    return ins.mongoClient
  }
  static mongoClientSync(name = 'master') {
    const ins = Context.insSync(name)
    return ins.mongoClient
  }
}
