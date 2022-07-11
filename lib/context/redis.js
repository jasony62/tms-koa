const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-koa-redis')
const redis = require('redis')

class Context {
  constructor(redisClient) {
    this.redisClient = redisClient
  }
}
Context.connect = async function (url) {
  let client
  if (typeof url === "string") {
    client = redis.createClient({ url })
  } else if (Object.prototype.toString.call(url) === '[object Object]') {
    client = redis.createCluster(url)
  } else {
    return Promise.reject("clientUrl 格式错误")
  }
  client.on('error', (err) => {
    logger.warn(`连接Redis失败：${err.message}`)
    client.quit(true)
    return Promise.reject(err)
  })

  logger.debug('开始连接[%s]', JSON.stringify(url))
  await client.connect()
  logger.debug('完成连接[%s]', JSON.stringify(url))

  return client
}
Context.ins = (function () {
  let _instancesByUrl = new Map()
  let _instancesByName = new Map()
  /**
   *
   */
  return async function (config, name) {
    if (typeof config === 'string' && undefined === name) {
      return _instancesByName.get(config)
    }
    let { host, port, user, password, masterAuthPasswor, masterAuthUser } = config || {}
    if (
      undefined === host &&
      undefined === port &&
      _instancesByUrl.size === 1
    ) {
      return _instancesByUrl.values().next().value
    }

    let url, mapUrlName
    if (typeof host === 'string') {
      url = `redis://`
      if (user) url += `${user}`
      if (password) url += `:${password}@`
      url += `${host}`

      if (typeof port === 'number')
        url += `:${port}`
      mapUrlName = url
    } else if (Array.isArray(host) && host.length > 0) {
      url = {
        rootNodes: []
      }
      host.forEach((h, i) => {
        let url2 = `redis://${h}`
        if (Array.isArray(port) && typeof port[i] === 'number')
          url2 += `:${port[i]}`

        let rootNodes = { url: url2 }
        if (Array.isArray(user) && typeof user[i] === 'string')
          rootNodes.username = user[i]
        if (Array.isArray(password) && typeof password[i] === 'string')
          rootNodes.password = password[i]

        url.rootNodes.push(rootNodes)
      })

      if (masterAuthPasswor || masterAuthUser) {
        url.defaults = {}
        if (masterAuthUser) url.defaults.username = masterAuthUser
        if (masterAuthPasswor) url.defaults.password = masterAuthPasswor
      }
      mapUrlName = JSON.stringify(url)
    } else {
      let msg = '没有指定Redis的主机地址'
      logger.error(msg)
      throw new Error(msg)
    }

    if (_instancesByUrl.has(mapUrlName)) return _instancesByUrl.get(mapUrlName)
    const client = await Context.connect(url)

    const instance = new Context(client)

    _instancesByUrl.set(mapUrlName, instance)
    _instancesByName.set(name, instance)

    return instance
  }
})()
/**
 * 按照配置文件进行初始化
 */
Context.init = async function (config) {
  if (!config || typeof config !== 'object') {
    let msg = '没有指定连接redis配置信息'
    logger.error(msg)
    throw new redis.RedisError(msg)
  }

  if (config.diabled === true) {
    return {}
  }

  const names = Object.keys(config).filter((n) => n !== 'disabled')
  if (names.length === 0) {
    let msg = '指定连接redis配置信息为空'
    logger.error(msg)
    throw new redis.RedisError(msg)
  }

  let instances
  if (names.includes('host')) {
    instances = [await Context.ins(config, 'master')]
  } else {
    instances = await Promise.all(
      names.map((name) => Context.ins(config[name], name))
    )
  }

  return instances
}

/**
 *
 */
Context.redisClient = async function (name = 'master', duplicate = false) {
  const ins = await Context.ins(name)
  if (!ins) throw new Error(`无法获得redis[${name}]连接实例`)
  if (duplicate === true) return ins.redisClient.duplicate()
  return ins.redisClient
}

module.exports = { Context }
