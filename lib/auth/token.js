const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-koa-redis')
const uuidv4 = require('uuid/v4')

const appConfig = require(process.cwd() + '/config/app')
if (typeof appConfig.auth !== 'object' || !appConfig.auth.redis) {
  let msg = '没有设置启用认证令牌参数'
  logger.error(msg)
  throw new Error(msg)
}
const redisConfig = appConfig.auth.redis

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
    const { host, port } = redisConfig
    const RedisContext = require('../redis').Context
    return RedisContext.ins({ host, port }).then(
      redisContext => new TokenInRedis(redisContext.redisClient)
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
    return new Promise(resolve => {
      this.redisClient.set(
        key,
        JSON.stringify({ expireAt: createAt + 7200, data: data }),
        () => {
          this.redisClient.expire(key, EXPIRE_IN, () => {
            resolve(EXPIRE_IN)
          })
        }
      )
    })
  }
  /**
   * 检查是否已经分配过token
   *
   * @param {*} clientId
   */
  scan(clientId) {
    return new Promise((resolve, reject) => {
      this.redisClient.scan(
        '0',
        'MATCH',
        `${INS_ID}:AccessToken:*:${clientId}`,
        (err, res) => {
          if (err) reject(err)
          else resolve(res[1])
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
  get(token) {
    return new Promise((resolve, reject) => {
      this.redisClient.scan(
        '0',
        'MATCH',
        `${INS_ID}:AccessToken:${token}:*`,
        (err, res) => {
          if (err) reject('access token error: redis error')
          else {
            if (res[1].length === 1) {
              let key = res[1][0]
              this.redisClient.get(key, (err, res) => {
                if (err) reject('access token error:redis error')
                else resolve(JSON.parse(res))
              })
            } else {
              reject('没有找到和access_token匹配的数据')
            }
          }
        }
      )
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

    // 清除已经存在的token
    const keys = await tokenRedis.scan(tmsClient.id)
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
        expire_in: expireIn
      }
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
}

module.exports = Token
