const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-koa-mongoose')

class MongoError extends Error {
  constructor(msg) {
    super(msg)
  }
}
/**
 * mongodb配置
 */
class Context {
  constructor(mongoose) {
    this.mongoose = mongoose
  }
}
Context.connect = function(url) {
  const mongoose = require('mongoose')

  return mongoose
    .connect(url, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    })
    .then(() => {
      mongoose.connection.on('error', err => {
        const msg = `mongodb操作错误：${err.message}`
        logger.error(msg)
        throw new MongoError(msg)
      })

      logger.info(`连接[${url}]成功`)
      return mongoose
    })
    .catch(err => {
      const msg = `连接[${url}]失败：${err.message}`
      logger.error(msg)
      return Promise.reject(new MongoError(msg))
    })
}
Context.ins = (function() {
  let _instances = new Map()
  return async function({ host, port, database }) {
    if (undefined === host && undefined === port && _instances.size === 1) {
      return _instances.values().next().value
    }
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
    if (typeof database !== 'string') {
      let msg = '没有指定mongodb连接的数据库'
      logger.error(msg)
      throw new MongoError(msg)
    }

    const url = `mongodb://${host}:${port}/${database}`

    if (_instances.has(url)) return _instances.get(url)

    logger.debug('开始连接 %s', url)
    const mongoose = await Context.connect(url)
    logger.debug('完成连接 %s', url)

    const instance = new Context(mongoose)

    _instances.set(url, instance)

    return instance
  }
})()
Context.init = Context.ins
Context.mongoose = async function() {
  const ins = await Context.ins({})
  return ins.mongoose
}

module.exports = { Context }
