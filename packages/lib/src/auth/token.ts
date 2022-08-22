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
  redisClient
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
  async store(token, clientId, data) {
    let createAt = Math.floor(Date.now() / 1000)
    let keyByToken = this.getKey(token)
    let keyByClientId = this.getKey(null, clientId)

    const _store = (key, _data) => {
      return new Promise((resolve, reject) => {
        this.redisClient
          .set(key, JSON.stringify(_data))
          .then((r) => {
            return this.expire(null, null, key)
          })
          .then((r) => resolve(r))
          .catch((e) => {
            logger.error(e)
            return reject('redis store error : redis error')
          })
      })
    }

    await _store(keyByToken, { expireAt: createAt + EXPIRE_IN, data })
    await _store(keyByClientId, { expireAt: createAt + EXPIRE_IN, token, data })

    return EXPIRE_IN
  }
  /**
   * 设置过期时间
   * @param {String} token
   * @param {String} clientId
   */
  async expire(token = null, clientId = null, _key = null) {
    const _expire = (key) => {
      return new Promise((resolve, reject) => {
        this.redisClient
          .expire(key, EXPIRE_IN)
          .then((r) => {
            return resolve(EXPIRE_IN)
          })
          .catch((e) => {
            logger.error(e)
            return reject('redis expire error : redis error')
          })
      })
    }

    let key, rst
    if (token) {
      key = this.getKey(token)
      rst = await _expire(key)
    }

    if (clientId) {
      key = this.getKey(null, clientId)
      rst = await _expire(key)
    }

    if (_key) {
      key = this.getKey(null, null, _key)
      rst = await _expire(key)
    }

    return rst
  }
  /**
   *
   */
  async del(token = null, clientId = null) {
    let key, rst
    if (token) {
      key = this.getKey(token)
      rst = await this.redisClient.del(key)
    }

    if (clientId) {
      key = this.getKey(null, clientId)
      rst = await this.redisClient.del(key)
    }

    return rst
  }
  /**
   * 根据token 或 clientid获得对应的数据
   *
   * @param {string} token
   */
  async get(token = null, clientId = null) {
    let key = this.getKey(token, clientId)

    return this.redisClient
      .get(key)
      .catch((e) => {
        logger.error(e)
        return Promise.reject('access get error:redis error')
      })
      .then((r) => {
        if (!r) return r
        else return JSON.parse(r)
      })
  }
  /**
   * 获取指定key的过期剩余时间
   *
   * @param {String} token
   */
  ttl(token = null, clientId = null) {
    let key = this.getKey(token, clientId)

    return new Promise((resolve, reject) => {
      this.redisClient
        .ttl(key)
        .then((r) => {
          return resolve(r)
        })
        .catch((err) => {
          logger.error(err)
          return reject('redis ttl error : redis error')
        })
    })
  }
  /**
   *
   */
  getKey(token = null, clientId = null, key = null) {
    let returnKey
    if (key) {
      returnKey = key
    } else if (token) {
      returnKey = `${INS_ID}:AccessToken:${token}`
    } else if (clientId) {
      returnKey = `${INS_ID}:ClientId:${clientId}`
    } else {
      throw new Error('参数缺失')
    }

    return returnKey
  }
  /**
   * 
   * 
   */
  async logout(token, clientId) {
    return this.del(token, clientId)
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

    const oldClientInfo = await tokenRedis.get(null, tmsClient.id)

    //是否支持多点登录
    if (oldClientInfo && tmsClient.allowMultiLogin === true) {
      const token = await multiLogin(oldClientInfo.token, tokenRedis)
      if (token[0] === true) {
        return [true, token[1]]
      }
    }

    // 清除已经存在的信息
    if (oldClientInfo) {
      await tokenRedis.del(oldClientInfo.token, tmsClient.id)
    }

    // 生成并保存新token
    const newToken = uuidv4().replace(/-/g, '')
    const expireIn = await tokenRedis.store(
      newToken,
      tmsClient.id,
      tmsClient.toPlainObject()
    )

    tokenRedis.quit()

    return [
      true,
      {
        access_token: newToken,
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
      if (!oResult) {
        return [false, '没有找到和access_token匹配的数据']
      }
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
  /**
   * 退出登录
   */
  static async logout(token) {
    let tokenRedis = await TokenInRedis.create()
    if (false === tokenRedis) return [false, '连接Redis服务失败']

    try {
      let oResult = await tokenRedis.get(token)
      if (!oResult) {
        return [false, '没有找到和access_token匹配的数据']
      }
      oResult = await tokenRedis.logout(token, oResult.data.id)
      return [true]
    } catch (e) {
      logger.error(e)
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
async function multiLogin(token, tokenRedis) {
  // 获取过期时间
  const expireIn = await tokenRedis.ttl(token)
  if (expireIn < 60) return [false, '即将过期']

  return [true, { access_token: token, expire_in: expireIn }]
}

export = Token
