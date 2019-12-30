const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-koa-redis')
const redis = require('redis')

class Context {
  constructor(redisClient) {
    this.redisClient = redisClient
  }
}
Context.connect = function(url) {
  return new Promise((resolve, reject) => {
    const client = redis.createClient(url)
    client.on('ready', () => {
      resolve(client)
    })
    client.on('error', err => {
      logger.warn(`连接Redis失败：${err.message}`)
      client.end(true)
      reject(err)
    })
  })
}
Context.ins = (function() {
  let _instances = new Map()
  return async function({ host, port }) {
    if (undefined === host && undefined === port && _instances.size === 1) {
      return _instances.values().next().value
    }
    if (typeof host !== 'string') {
      let msg = '没有指定Redis的主机地址'
      logger.error(msg)
      throw new redis.RedisError(msg)
    }
    if (typeof port !== 'number') {
      let msg = '没有指定Redis连接的端口'
      logger.error(msg)
      throw new redis.RedisError(msg)
    }

    const url = `redis://${host}:${port}`

    if (_instances.has(url)) return _instances.get(url)

    logger.debug('开始连接[%s]', url)
    const client = await Context.connect(url)
    logger.debug('完成连接[%s]', url)

    const instance = new Context(client)

    _instances.set(url, instance)

    return instance
  }
})()
Context.init = Context.ins
Context.redisClient = async function() {
  const ins = await Context.ins({})
  return ins.redisClient
}

module.exports = { Context }
