const fs = require('fs')
const path = require('path')
const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-koa')
const { MongoClient, MongoError } = require('mongodb')

class MongoConfig {
  get url() {
    return `mongodb://${this.host}:${this.port}`
  }
}
MongoConfig.connect = function(host, port) {
  return MongoClient.connect(`mongodb://${host}:${port}`, {
    useUnifiedTopology: true
  })
}
MongoConfig.ins = (function() {
  let instance
  return async function(config) {
    if (instance) return instance
    if (undefined === config) {
      const filename = path.resolve('config/mongodb.js')
      if (!fs.existsSync(filename)) {
        const msg = `配置文件${filename}不存在`
        logger.error(msg)
        return new MongoError(msg)
      }
      config = require(filename)
      logger.info(`加载配置文件'${filename}'成功`)
    }

    const { host, port } = config

    if (typeof host !== 'string') {
      let msg = '没有指定mongodb的主机地址'
      logger.error(msg)
      throw new MongoError(msg)
    }
    if (typeof port !== 'number') {
      let msg = '没有指定mongodb连接的端口'
      logger.error(msg)
      throw new MongoError(msg)
    }

    const client = await MongoConfig.connect(host, port)

    // eslint-disable-next-line require-atomic-updates
    instance = Object.assign(new MongoConfig(), {
      host,
      port,
      client
    })

    logger.info(`连接[${instance.url}]成功`)

    return instance
  }
})()

class Context {
  constructor(mongoClient) {
    this.mongoClient = mongoClient
  }
}
Context.ins = (function() {
  let instance
  return async function(config) {
    if (instance) return Promise.resolve(instance)

    const { client } = await MongoConfig.ins(config)

    // eslint-disable-next-line require-atomic-updates
    instance = new Context(client)

    return Promise.resolve(instance)
  }
})()
Context.init = Context.ins
Context.mongoClient = async function() {
  const ins = await Context.ins()
  return ins.mongoClient
}

module.exports = { Context }
