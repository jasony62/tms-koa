/* eslint-disable node/no-unsupported-features/es-syntax */
const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-koa-redis')
const uuidv4 = require('uuid').v4

const { AppContext } = require('../app').Context
const { auth: authConfig } = AppContext.insSync()
if (!authConfig) {
  let msg = '没有设置启用认证令牌参数'
  logger.error(msg)
  throw new Error(msg)
}

const redisConfig = authConfig.redis

// token过期时间
const EXPIRE_IN = redisConfig.expiresIn || 3600

const INS_ID = redisConfig.prefix || 'tms-koa-token'
/**
 * 在redis中保存客户端的access_token
 */
class TokenInRedis {
  /**
   *
   * @param {*} redisClient
   */
  constructor(redisClient) {
    this.redisClient = redisClient
  }
  // 连接redis
  static create() {
    const { RedisContext } = require('../app').Context
    return RedisContext.ins(redisConfig).then(
      (redisContext) => new TokenInRedis(redisContext.redisClient)
    )
  }
  quit() {
    //this.redisClient.quit()
  }
  /**
   * 保存创建的token
   *
   * @param {String} token
   * @param {String} clientId
   * @param {Object} data
   */
  store(token, clientId, data) {
    let createAt = parseInt((new Date() * 1) / 1000)
    let key = `${INS_ID}:AccessToken:${token}:${clientId}`
    return new Promise((resolve, reject) => {
      this
        .redisClient
        .set(
          key,
          JSON.stringify({ expireAt: createAt + EXPIRE_IN, data: data })
        )
        .then(r => {
          return this.expire(token, clientId)
        })
        .then(r => resolve(r))
        .catch(e => {
          logger.error(e)
          return reject('redis store error : redis error')
        })
    })
  }
  /**
   * 设置过期时间
   * @param {String} token
   * @param {String} clientId
   */
  expire(token, clientId) {
    let key = `${INS_ID}:AccessToken:${token}:${clientId}`
    return new Promise((resolve, reject) => {
      this
        .redisClient
        .expire(key, EXPIRE_IN)
        .then(r => {
          return resolve(EXPIRE_IN)
        })
        .catch(e => {
          logger.error(e)
          return reject('redis expire error : redis error')
        })
    })
  }
  /**
   * 检查是否已经分配过token
   *
   * @param {*} clientId
   */
  async scan(clientId) {
    let keys = []
    for await (
      const key
      of
      this
        .redisClient
        .scanIterator({
          MATCH: `${INS_ID}:AccessToken:*:${clientId}`,
          COUNT: 500
        })
    ) {
      keys.push(key)
    }
    return keys
  }
  /**
   *
   * @param {array} keys
   */
  async del(keys) {
    return this.redisClient.del(keys)
  }
  /**
   * 根据token获得对应的数据
   *
   * @param {string} token
   */
  async get(token) {
    let keys = []
    for await (
      const key
      of
      this
        .redisClient
        .scanIterator({
          MATCH: `${INS_ID}:AccessToken:${token}:*`,
          COUNT: 500
        })
    ) {
      keys.push(key)
    }

    if (keys.length === 1) {
      let key = keys[0]
      return this
        .redisClient.get(key)
        .then(r => Promise.resolve(JSON.parse(r)))
        .catch(e => {
          logger.error(e)
          return Promise.reject('access get error:redis error')
        })
    } else {
      return Promise.reject('没有找到和access_token匹配的数据')
    }
  }
  /**
   * 获取指定key的过期剩余时间
   *
   * @param {String} token
   */
  ttl(key) {
    return new Promise((resolve, reject) => {
      this
        .redisClient
        .ttl(key)
        .then(r => {
          return resolve(r)
        })
        .catch(err => {
          logger.error(err)
          return reject('redis ttl error : redis error')
        })
    })
  }
}
/**
 * 身份令牌
 */
class Token {
  /**
   * 生成token
   * 每次生成新token都要替换掉之前的token
   *
   * @param {Client} tmsClient
   *
   */
  static async create(tmsClient) {
    const tokenRedis = await TokenInRedis.create()
    if (false === tokenRedis) return [false, '连接Redis服务失败']
    const keys = await tokenRedis.scan(tmsClient.id)

    //是否支持多点登录
    if (tmsClient.allowMultiLogin === true) {
      const token = await multiLogin(keys, tmsClient, tokenRedis)
      if (token[0] === true) {
        return [true, token[1]]
      }
    }

    // 清除已经存在的token
    if (keys && keys.length) await tokenRedis.del(keys)

    // 生成并保存新token
    const token = uuidv4().replace(/-/g, '')
    const expireIn = await tokenRedis.store(
      token,
      tmsClient.id,
      tmsClient.toPlainObject()
    )

    tokenRedis.quit()

    return [
      true,
      {
        access_token: token,
        expire_in: expireIn,
      },
    ]
  }
  /**
   * 获取token对应的数据
   *
   * @param {*} token
   *
   */
  static async fetch(token) {
    let tokenRedis = await TokenInRedis.create()
    if (false === tokenRedis) return [false, '连接Redis服务失败']

    try {
      let oResult = await tokenRedis.get(token)
      let oTmsClient = require('./client').createByData(oResult.data)
      return [true, oTmsClient]
    } catch (e) {
      return [false, e]
    } finally {
      tokenRedis.quit()
    }
  }
  /**
   * 重置token过期时间
   * @param {*} token
   */
  static async expire(token, tmsClient) {
    let tokenRedis = await TokenInRedis.create()
    if (false === tokenRedis) return [false, '连接Redis服务失败']

    try {
      const expire_in = await tokenRedis.expire(token, tmsClient.id)
      return [true, expire_in]
    } catch (e) {
      return [false, e]
    } finally {
      tokenRedis.quit()
    }
  }
}

/**
 *
 * @param {*}
 */
async function multiLogin(keys, tmsClient, tokenRedis) {
  if (keys.length !== 1) return [false, "存储异常，存在多条数据"]

  const key = keys[0]
  // 获取过期时间
  const expireIn = await tokenRedis.ttl(key)
  if (expireIn < 60) return [false, "即将过期"]
  // 解析出 token
  const reg = new RegExp(
    '(?<=' + `${INS_ID}:AccessToken:` + ').*?(?=' + `:${tmsClient.id}` + ')'
  )
  const tokens = key.match(reg)
  if (!tokens) return [false, "token解析失败"]

  return [true, { access_token: tokens[0], expire_in: expireIn }]
}

module.exports = Token
