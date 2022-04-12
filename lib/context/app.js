const _ = require('lodash')
const fs = require('fs')
const modPath = require('path')
const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-koa-app')

/**
 * 使用配置文件中指定的账号用于请求认证
 * @param {*} ctx
 */
function localCreateTmsClient(ctx, accounts) {
  let aResult
  const { username, password } = ctx.request.body
  if (!username || !password) {
    aResult = [false, '没有提供用户名或密码']
  } else {
    const found = accounts.find(
      (a) => a.username === username && a.password === password
    )
    if (found) {
      const tmsClient = require('../auth/client').createByData({
        id: found.id,
        data: { username },
        isAdmin: found.isAdmin === true,
        allowMultiLogin: found.allowMultiLogin === true,
      })
      aResult = [true, tmsClient]
    } else {
      logger.debug(`用户名[${username}]或密码[${password}]错误`)
      aResult = [false, '用户名或密码错误']
    }
  }
  return aResult
}
/**
 * 返回当前用户，当前请求对应的bucket
 *
 * @param {*} ctx
 * @param {*} client
 */
async function checkClientBucket(ctx, client) {
  const { bucket } = ctx.request.query

  if (!this.bucketValidator) return [true, bucket ? bucket : '']

  const result = await this.bucketValidator(ctx, client)

  if (!Array.isArray(result)) return [false]

  let [passed, validBucket] = result

  if (passed !== true || typeof validBucket !== 'string') return [false]

  return [passed, validBucket]
}

/* 初始化端口 */
function initServer(instance, appConfig) {
  const { port, https, cors } = appConfig
  instance.port = port
  if (https && typeof https === 'object') {
    const { port, key, cert } = https
    let valid = true
    if (!parseInt(port)) {
      logger.warn(`指定的https服务端口[${port}]不可用`)
      valid = false
    }
    if (!fs.existsSync(key)) {
      logger.warn(`指定的https服务key文件[${key}]不存在`)
      valid = false
    }
    if (!fs.existsSync(cert)) {
      logger.warn(`指定的https服务cert文件[${cert}]不存在`)
      valid = false
    }
    if (valid) instance.https = { port, key, cert }
  }
  if (cors && typeof cors === 'object') {
    instance.cors = {}
    const { origin, credentials } = cors
    if (origin && origin instanceof String) instance.cors.origin = origin
    if (credentials === true) instance.cors.credentials = true
  }
}
/* 初始化文件下载服务 */
function initFsdomain(instanceRouter, fsdomainConfig) {
  let validConfig = {}
  let { prefix } = fsdomainConfig
  if (prefix && typeof prefix === 'string') {
    if (prefix[0] !== '/') prefix = `/${prefix}`
    validConfig.prefix = prefix
  }
  if (Object.keys(validConfig).length) instanceRouter.fsdomain = validConfig
}
/* 初始化控制器路由 */
function initRouter(instance, appConfig) {
  if (appConfig.router) {
    const { auth, controllers, fsdomain, swagger, metrics } = appConfig.router
    instance.router = { auth, controllers, swagger, metrics }
    if (fsdomain) initFsdomain(instance.router, fsdomain)
  }
}

/* 初始化访问控制 */
async function initAuth(instance, appConfig) {
  const { auth } = appConfig
  if (!auth || auth.disabled === true) return

  const { captcha, client, jwt, redis, bucket } = auth
  const authConfig = {}

  if (typeof jwt === 'object' && jwt.disabled !== true) {
    let { privateKey, expiresIn } = jwt
    if (typeof privateKey === 'string') {
      authConfig.mode = 'jwt'
      authConfig.jwt = jwt
      if (!expiresIn) authConfig.jwt.expiresIn = 3600
    } else logger.warn(`启用API调用认证机制[jwt]失败，参数不完整`)
  } else if (typeof redis === 'object' && redis.disabled !== true) {
    let { host, port, password } = redis
    if (typeof host === 'string') {
      try {
        await require('./redis').Context.init({ host, port, password })
        authConfig.mode = 'redis'
        authConfig.redis = redis
      } catch (e) {
        let logMsg = `启用API调用认证机制[redis]失败，${e.message}`
        logger.isDebugEnabled() ? logger.debug(logMsg, e) : logger.warn(logMsg)
      }
    } else logger.warn(`启用API调用认证机制[redis]失败，参数不完整`)
  }

  if (authConfig.mode) {
    if (client && typeof client === 'object') {
      const { path, npm, accounts } = client
      if (typeof npm === 'object' && npm.disabled !== true) {
        const { id, authentication } = npm
        if (typeof id !== 'string') throw Error(`通过[auth.client.npm.id]类型`)
        if (typeof authentication !== 'string')
          throw Error(`通过[auth.client.npm.authentication]类型`)
        let createTmsClient
        if (authentication) {
          createTmsClient = require(`${id}/${authentication}`)
        } else {
          createTmsClient = require(id)
        }
        if (typeof createTmsClient !== 'function')
          throw Error(`通过[npm=${id}]设置的用户认证外部方法的类型不是函数`)
        authConfig.client = { createTmsClient }
      } else if (typeof path === 'string') {
        /* 指定了外部认证方法 */
        const pathClient = modPath.resolve(path)
        if (!fs.existsSync(pathClient))
          throw Error('设置的用户认证外部方法不存在')
        let createTmsClient = require(pathClient)
        if (typeof createTmsClient !== 'function')
          throw Error('设置的用户认证外部方法的类型不是函数')
        authConfig.client = { createTmsClient }
      } else if (Array.isArray(accounts) && accounts.length) {
        /* 指定了本地账号 */
        authConfig.client = {
          accounts,
          createTmsClient: function (ctx) {
            return localCreateTmsClient(ctx, accounts)
          },
        }
      }
    }
    if (captcha && typeof captcha === 'object') {
      const { path, code, npm } = captcha
      if (typeof npm === 'object' && npm.disabled !== true) {
        const { id, authentication } = npm
        if (typeof id !== 'string') throw Error(`通过[auth.captcha.npm.id]类型`)
        if (typeof authentication !== 'string')
          throw Error(`通过[auth.captcha.npm.authentication]类型`)
        let createCaptcha
        if (authentication) {
          createCaptcha = require(`${id}/${authentication}`)
        } else {
          createCaptcha = require(id)
        }
        if (typeof createCaptcha !== 'function')
          throw Error(`通过[npm=${id}]设置的验证码外部方法的类型不是函数`)
        authConfig.captcha = { createCaptcha }
      } else if (typeof path === 'string') {
        const pathCaptcha = modPath.resolve(path)
        if (!fs.existsSync(pathCaptcha))
          throw Error('未设置用验证码限制调用用户认证接口的方法')
        const fnCreateCaptcha = require(pathCaptcha)
        if (typeof fnCreateCaptcha !== 'function')
          throw Error('设置的生成验证码方法的类型不是函数')
        authConfig.captcha = { createCaptcha: fnCreateCaptcha }
      } else if (typeof code === 'string') {
        authConfig.captcha = { code }
      }
    }
  }
  if (bucket && bucket.validator) {
    if (typeof bucket.validator === 'string') {
      let validatorPath = modPath.resolve(bucket.validator)
      try {
        const validator = require(validatorPath)
        if (typeof validator === 'function') {
          instance.bucketValidator = validator
          instance.checkClientBucket = checkClientBucket
          logger.info('指定了bucket验证函数')
        } else {
          logger.warn(`指定的bucket验证模块[${bucket.validator}]返回的不是函数`)
        }
      } catch (e) {
        logger.warn(`指定的bucket验证模块[${bucket.validator}]不存在`)
      }
    } else if (bucket.validator === true) {
      instance.checkClientBucket = checkClientBucket
      logger.info('指定了透穿bucket参数')
    }
  }

  instance.auth = authConfig
}

class Context {
  constructor(appConfig) {
    this.appConfig = appConfig
  }
  get routerControllersPrefix() {
    let prefix = _.get(this, ['router', 'controllers', 'prefix'], '')
    if (prefix && !/^\//.test(prefix)) prefix = `/${prefix}`
    return prefix
  }
  get routerAuthPrefix() {
    // 路由前缀必须以反斜杠开头
    let prefix = _.get(this, ['router', 'auth', 'prefix'], '')
    if (prefix && !/^\//.test(prefix)) prefix = `/${prefix}`
    return prefix
  }
  get excelDomainName() {
    return _.get(this, ['router', 'controllers', 'excel', 'outputDomain'], '')
  }
}

Context.init = (function () {
  let _instance

  return async function (appConfig) {
    if (_instance) return _instance

    _instance = new Context(appConfig)

    initServer(_instance, appConfig)

    initRouter(_instance, appConfig)

    await initAuth(_instance, appConfig)

    Context.insSync = function () {
      return _instance
    }

    logger.info(`完成应用基础设置。`)

    return _instance
  }
})()
Context.ins = Context.init

module.exports = { Context }
