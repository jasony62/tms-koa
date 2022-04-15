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
    const { host, port, password } = redisConfig
    const { RedisContext } = require('../app').Context
    return RedisContext.ins({ host, port, password }).then(
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
    return new Promise((resolve) => {
      this.redisClient.set(
        key,
        JSON.stringify({ expireAt: createAt + EXPIRE_IN, data: data }),
        () => {
          this.expire(token, clientId).then(() => resolve(EXPIRE_IN))
        }
      )
    })
  }
  /**
   * 设置过期时间
   * @param {String} token
   * @param {String} clientId
   */
  expire(token, clientId) {
    let key = `${INS_ID}:AccessToken:${token}:${clientId}`
    return new Promise((resolve) => {
      this.redisClient.expire(key, EXPIRE_IN, () => {
        resolve(EXPIRE_IN)
      })
    })
  }
  /**
   * 检查是否已经分配过token
   *
   * @param {*} clientId
   */
  scan(clientId, cursor = '0', keys = []) {
    return new Promise((resolve, reject) => {
      this.redisClient.scan(
        cursor,
        'MATCH',
        `${INS_ID}:AccessToken:*:${clientId}`,
        'COUNT',
        '500',
        (err, res) => {
          if (err) return reject(err)
          else {
            if (res[1].length) keys.push(...res[1])
            if (res[0] !== '0') {
              return this.scan(clientId, res[0], keys)
                .then((r) => resolve(r))
                .catch((e) => reject(e))
            } else {
              return resolve(keys)
            }
          }
        }
      )
    })
  }
  /**
   *
   * @param {array} keys
   */
  del(keys) {
    this.redisClient.del(...keys)
  }
  /**
   * 根据token获得对应的数据
   *
   * @param {string} token
   */
  get(token, cursor = '0', keys = []) {
    return new Promise((resolve, reject) => {
      this.redisClient.scan(
        cursor,
        'MATCH',
        `${INS_ID}:AccessToken:${token}:*`,
        'COUNT',
        '500',
        (err, res) => {
          if (err) return reject('access token error: redis error')
          else {
            if (res[1].length) keys.push(...res[1])
            if (res[0] !== '0') {
              return this.get(token, res[0], keys)
                .then((r) => resolve(r))
                .catch((e) => reject(e))
            } else {
              if (keys.length === 1) {
                let key = keys[0]
                this.redisClient.get(key, (e, r) => {
                  if (e) return reject('access token error:redis error')
                  else return resolve(JSON.parse(r))
                })
              } else {
                return reject('没有找到和access_token匹配的数据')
              }
            }
          }
        }
      )
    })
  }
  /**
   * 获取指定key的过期剩余时间
   *
   * @param {String} token
   */
  ttl(key) {
    return new Promise((resolve, reject) => {
      this.redisClient.ttl(key, (err, expireIn) => {
        if (err) return reject(err)
        resolve(expireIn)
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
    if (keys && keys.length) tokenRedis.del(keys)

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
  if (keys.length !== 1) return [false]

  const key = keys[0]
  // 获取过期时间
  const expireIn = await tokenRedis.ttl(key)
  if (expireIn < 60) return [false]
  // 解析出 token
  const reg = new RegExp(
    '(?<=' + `${INS_ID}:AccessToken:` + ').*?(?=' + `:${tmsClient.id}` + ')'
  )
  const tokens = key.match(reg)
  if (!tokens) return [false]

  return [true, { access_token: tokens[0], expire_in: expireIn }]
}

module.exports = Token
