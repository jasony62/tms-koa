import * as _ from 'lodash'
import { customAlphabet } from 'nanoid'
import { getLogger } from '@log4js-node/log4js-api'
const logger = getLogger('tms-koa-captcha')

import { loadConfig } from 'tms-koa'

import { Context as lowdbContext } from './lowdb.js'

const CaptchaConfig = loadConfig('captcha', {})

/**
 * 在redis中保存客户端的验证码
 */
class InRedis {
  redisClient

  /**
   *
   * @param {*} redisClient
   */
  constructor(redisClient) {
    this.redisClient = redisClient
  }
  //
  key(appid, captchaid) {
    return `${'tms-koa-captcha'}:captcha:${appid}:${captchaid}`
  }
  // 连接redis
  static create() {
    let redisContext = require('tms-koa').Context.RedisContext
    if (!redisContext) throw new Error('未找到redis连接')

    let redisConfig = loadConfig('redis')
    if (!redisConfig.host) {
      // let redisName =
      //   AccountConfig.redis && AccountConfig.redis.name
      //     ? AccountConfig.redis.name
      //     : 'master'
      let redisName = 'master'
      redisConfig = redisConfig[redisName]
      if (!redisConfig) {
        return Promise.reject('未找到指定的redis配置信息')
      }
    }
    return redisContext
      .ins(redisConfig)
      .then((context) => new InRedis(context.redisClient))
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
  store(appid, captchaid, data, expire_in) {
    let key = this.key(appid, captchaid)
    return new Promise((resolve, reject) => {
      this.redisClient
        .set(key, JSON.stringify(data))
        .then((r) => {
          return this.expire(appid, captchaid, expire_in)
        })
        .then((r) => {
          return resolve(r)
        })
        .catch((err) => {
          logger.error(err)
          return reject('redis store error : redis error')
        })
    })
  }
  /**
   * 设置过期时间
   * @param {String} token
   * @param {String} clientId
   */
  expire(appid, captchaid, expire_in) {
    let key = this.key(appid, captchaid)
    return new Promise((resolve, reject) => {
      this.redisClient
        .expire(key, expire_in)
        .then((r) => {
          return resolve(expire_in)
        })
        .catch((e) => {
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
  async scan(appid, captchaid, keys = []) {
    for await (const key of this.redisClient.scanIterator({
      MATCH: this.key(appid, captchaid),
      COUNT: 500,
    })) {
      keys.push(key)
    }
    return keys
  }
  /**
   * 获得对应的数据
   *
   * @param {string}
   */
  get(appid, captchaid) {
    let key = this.key(appid, captchaid)
    return new Promise((resolve, reject) => {
      this.redisClient
        .get(key)
        .then((r) => {
          return resolve(JSON.parse(r))
        })
        .catch((e) => {
          logger.error(e)
          return reject('redis get error : redis error')
        })
    })
  }
  /**
   *
   * @param {array} keys
   */
  async del(appid, captchaid) {
    let key = this.key(appid, captchaid)
    return this.redisClient.del(key)
  }
}

/**
 *
 */
class Captcha {
  static ins: any
  numberAlphabet: string
  upperCaseAlphabet: string
  lowerCaseAlphabet: string
  storageType: string
  masterCaptcha: string | null
  alphabetType: string
  codeSize: number
  expire: number
  limit: number
  alphabet: string
  code: string
  lowClient: any
  redisClient: any

  constructor(config) {
    this.numberAlphabet = '1234567890'
    this.upperCaseAlphabet = 'QWERTYUIOPASDFGHJKLZXCVBNM'
    this.lowerCaseAlphabet = 'qwertyuiopasdfghjklzxcvbnm'

    this.storageType = config.storageType || 'lowdb'
    this.masterCaptcha = config.masterCaptcha || null
    this.alphabetType = config.alphabetType || 'number,upperCase,lowerCase'
    this.codeSize = parseInt(config.codeSize) || 4
    this.expire = parseInt(config.expire) || 300
    this.limit = parseInt(config.limit) || 3

    if (config.alphabet) {
      this.alphabet = config.alphabet
    } else {
      let codeAlphabet = ''
      this.alphabetType.split(',').forEach((v) => {
        switch (v) {
          case 'number':
            codeAlphabet += this.numberAlphabet
            break
          case 'upperCase':
            codeAlphabet += this.upperCaseAlphabet
            break
          case 'lowerCase':
            codeAlphabet += this.lowerCaseAlphabet
            break
        }
      })
      if (codeAlphabet.length === 0) throw new Error('验证码字母表为空')
      this.alphabet = codeAlphabet
    }
  }
  /**
   *
   * @returns
   */
  getCode() {
    if (this.code) {
      return this.code
    }

    const nanoid = customAlphabet(this.alphabet, this.codeSize)
    this.code = nanoid()
    return this.code
  }
  /**
   * 保存验证码到存储服务中
   */
  async storageCode(appid, captchaid) {
    if (!captchaid || !appid) {
      return [false, '无法存储验证码，参数不完整']
    }

    let code = this.getCode()

    const data = {
      appid,
      captchaid,
      code,
      expire_at: (Date.now() + this.expire) * 1000,
      limit: this.limit,
    }

    await this.removeCodeByUser(appid, captchaid) // 清空此用户的验证码
    if (this.storageType === 'lowdb') {
      const lowClient = this.getLowDbClient()
      lowClient.data.captchas.push(data).write() // 添加
    } else if (this.storageType === 'redis') {
      const redisClient = await this.getRedisClient()
      await redisClient.store(appid, captchaid, data, this.expire)
    } else {
      return [false, '暂不支持的储存方式']
    }

    return [true, code]
  }
  /**
   *
   * @param {*} appid
   * @param {*} captchaid
   * @param {*} code
   * @param {*} strictMode Y | N 检验大小写
   * @returns
   */
  async checkCode(appid, captchaid, code, strictMode = 'N') {
    if (!captchaid || !appid || !code) {
      return [false, '无法验证验证验证码，缺少必要的参数']
    }

    if (this.masterCaptcha && this.masterCaptcha === code) {
      //万能验证码
      await this.removeCodeByUser(appid, captchaid)
      return [true, { appid, captchaid, code }]
    }

    let captchaCode,
      current = Date.now()
    if (this.storageType === 'lowdb') {
      const lowClient = this.getLowDbClient()
      lowClient.read()
      let captchaCodes = lowClient.data.captchas
        .filter((v) => {
          let pass = v.appid === appid && v.captchaid === captchaid
          if (pass) {
            if (strictMode === 'Y') pass = v.code === code
            else pass = v.code.toLowerCase() === code.toLowerCase()
          }
          return pass
        })
        .value()

      if (captchaCodes.length === 0) return [false, '验证码错误']
      if (captchaCodes.length > 1) {
        await this.removeCodeByUser(appid, captchaid)
        return [false, '验证码获取错误']
      }

      captchaCode = captchaCodes[0]
      await this.removeCodeByUser(appid, captchaid)
      if (captchaCode.expire_at < current) {
        // 验证码过期
        return [false, '验证码已过期']
      }
    } else if (this.storageType === 'redis') {
      const redisClient = await this.getRedisClient()
      captchaCode = await redisClient.get(appid, captchaid)
      if (!captchaCode) return [false, '验证码错误']

      let pass
      if (strictMode === 'Y') pass = captchaCode.code === code
      else pass = captchaCode.code.toLowerCase() === code.toLowerCase()
      if (!pass) {
        return [false, '验证码错误']
      } else {
        await this.removeCodeByUser(appid, captchaid)
      }
    } else {
      return [false, '暂不支持的储存方式']
    }

    return [true, captchaCode]
  }
  /**
   * 删除用户验证码
   * @returns
   */
  async removeCodeByUser(appid, captchaid) {
    if (this.storageType === 'lowdb') {
      this.getLowDbClient().data.captchas.remove({ appid, captchaid }).write()
    } else if (this.storageType === 'redis') {
      const redisClient = await this.getRedisClient()
      await redisClient.del(appid, captchaid)
    } else {
      return [false, '暂不支持的储存方式']
    }

    return [true]
  }
  /**
   *
   */
  getLowDbClient() {
    if (this.lowClient) {
      return this.lowClient
    }

    const instance = lowdbContext.ins()
    const db = instance.getDBSync()

    this.lowClient = db
    return this.lowClient
  }
  /**
   *
   */
  async getRedisClient() {
    if (this.redisClient) {
      return this.redisClient
    }

    this.redisClient = await InRedis.create()
    return this.redisClient
  }
}

Captcha.ins = (config = {}) => {
  let config2 = _.merge({}, CaptchaConfig, config)

  return new Captcha(config2)
}

/**
 * 检查验证码
 * @param {*} ctx
 * @returns
 */
async function checkCaptcha(ctx) {
  let storageType, captchaid, appid, code, strictMode

  if (ctx.request.method === 'GET') {
    storageType = ctx.request.query.storageType
    appid = ctx.request.query.appid
    captchaid = ctx.request.query.captchaid
    code = ctx.request.query.code
    strictMode = ctx.request.query.strictMode
  } else if (ctx.request.method === 'POST') {
    storageType = ctx.request.body.storageType
    appid = ctx.request.body.appid
    captchaid = ctx.request.body.captchaid
    code = ctx.request.body.code
    strictMode = ctx.request.body.strictMode
  }

  if (!captchaid || !appid || !code) {
    return [false, '检查验证码未通过，参数不完整']
  }

  const instance = Captcha.ins({ storageType })
  return instance.checkCode(appid, captchaid, code, strictMode)
}
/**
 * 生成图形验证码
 */
async function createCaptcha(ctx) {
  let code,
    restrainCode,
    storageType,
    alphabetType,
    alphabet,
    codeSize,
    expire,
    limit,
    captchaid,
    appid,
    width,
    height,
    fontSize,
    noise,
    background,
    returnType = 'image'

  if (ctx.request.method === 'GET') {
    storageType = ctx.request.query.storageType
    alphabetType = ctx.request.query.alphabetType
    alphabet = ctx.request.query.alphabet
    codeSize = ctx.request.query.codeSize
    expire = ctx.request.query.expire
    limit = ctx.request.query.limit
    appid = ctx.request.query.appid
    captchaid = ctx.request.query.captchaid
    restrainCode = ctx.request.query.restrainCode
    code = ctx.request.query.code
    width = ctx.request.query.width
    height = ctx.request.query.height
    fontSize = ctx.request.query.fontSize
    noise = ctx.request.query.noise
    background = ctx.request.query.background
    returnType = ctx.request.query.returnType
  } else if (ctx.request.method === 'POST') {
    storageType = ctx.request.body.storageType
    alphabetType = ctx.request.body.alphabetType
    alphabet = ctx.request.body.alphabet
    codeSize = ctx.request.body.codeSize
    expire = ctx.request.body.expire
    limit = ctx.request.body.limit
    appid = ctx.request.body.appid
    captchaid = ctx.request.body.captchaid
    restrainCode = ctx.request.body.restrainCode
    code = ctx.request.body.code
    width = ctx.request.body.width
    height = ctx.request.body.height
    fontSize = ctx.request.body.fontSize
    noise = ctx.request.body.noise
    background = ctx.request.body.background
    returnType = ctx.request.body.returnType
  }

  let config = {
    storageType,
    alphabetType,
    alphabet,
    codeSize,
    expire,
    limit,
  }
  const instance = Captcha.ins(config)
  if (restrainCode) {
    // 校验验证码
    if (!captchaid || !appid) return [false, '无法创建验证码，参数不完整']
    const codeInfo = await instance.checkCode(appid, captchaid, restrainCode)
    if (codeInfo[0] === false) return [false, codeInfo[1]]
  }

  if (!code) {
    // 没有就生成code
    let rst = instance.getCode()
    rst = await instance.storageCode(appid, captchaid)
    if (rst[0] === false) return rst
    code = rst[1]
  }

  // 直接返回验证码
  if (returnType === 'text') return [true, code]

  // 生成验证码图片
  let captchaOptions: any = {}
  captchaOptions.noise = 2 // number of noise lines
  captchaOptions.background = '#48d1cc' // number of noise lines

  if (width) captchaOptions.width = width
  if (height) captchaOptions.height = height
  if (fontSize) captchaOptions.fontSize = fontSize
  if (noise) captchaOptions.noise = noise
  if (background) captchaOptions.background = `#${background}`

  const svgCaptcha = require('svg-captcha')
  let imageCap = svgCaptcha(code, captchaOptions)

  return [true, imageCap]
}

export default createCaptcha
export { createCaptcha, checkCaptcha, Captcha }
