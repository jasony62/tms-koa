const _ = require('lodash')
const fs = require('fs')
const modPath = require('path')
const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-koa-app')

/**
 * 使用配置文件中指定的账号用于请求认证
 * @param {*} ctx
 */
async function localCreateTmsClient(ctx, accounts) {
  const authConfig = Context.insSync().auth
  let captchaConfig = _.get(authConfig, ['captcha'], {})
  const { checkCaptcha } = captchaConfig

  if (typeof checkCaptcha === 'function') {
    let cResult = await checkCaptcha(ctx)
    if (cResult[0] === false) return cResult
  } else return [false, '没有指定验证码检查程序']

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
 * 使用配置文件中指定的账号用于注册
 * @param {*} ctx
 */
async function localRegisterTmsClient(ctx, accounts) {
  const authConfig = Context.insSync().auth
  let captchaConfig = _.get(authConfig, ['captcha'], {})
  const { checkCaptcha } = captchaConfig

  if (typeof checkCaptcha === 'function') {
    let cResult = await checkCaptcha(ctx)
    if (cResult[0] === false) return cResult
  } else return [false, '没有指定验证码检查程序']

  const userInfo = ctx.request.body
  accounts.push(userInfo)
  return [true, userInfo]
}
/**
 * 使用配置文件指定的验证码用于生产验证码
 * @param {*} ctx
 * @returns
 */
function localCreateCaptcha(ctx, code) {
  if (typeof code === 'string' && code) {
    return [true, code]
  } else return [false, '没有提供默认验证码']
}
/**
 * 使用配置文件指定的验证码用于校验验证码
 * @param {*} ctx
 * @returns
 */
function localCheckCaptcha(ctx, sysCode) {
  let { request } = ctx
  let code = request.query.code || request.body.code
  if (code) {
    if (code === sysCode) {
      return [true, { code }]
    } else return [false, '验证码错误']
  } else {
    return [false, '未找到验证码']
  }
}
/**
 * 返回当前用户，当前请求对应的bucket
 *
 * @param {*} ctx
 * @param {*} client
 */
async function checkClientBucket(ctx, client) {
  const { bucket } = ctx.request.query
  /**
   * 如果指定的本地账号中包含bucket信息，使用账号携带的信息
   */
  if (typeof Context.insSync().auth.client === 'object') {
    const { accounts } = Context.insSync().auth.client
    if (Array.isArray(accounts) && accounts.length) {
      const account = accounts.find((a) => a.id === client.id)
      if (!account || !account.bucket) return [false]
      let passed = false
      if (Array.isArray(account.bucket)) {
        passed = account.bucket.find((rule) => {
          return new RegExp(rule).test(bucket)
        })
      } else if (typeof account.bucket === 'string') {
        passed = new RegExp(account.bucket).test(bucket)
      }
      return passed ? [true, bucket] : [false]
    }
  }
  /**没有指定检查方法，透穿bucket*/
  if (!this.bucketValidator) return [true, bucket ? bucket : '']

  /**
   * 用指定的方法检查bucket
   */
  const result = await this.bucketValidator(ctx, client)

  if (!Array.isArray(result)) return [false]

  let [passed, validBucket] = result

  if (passed !== true || typeof validBucket !== 'string') return [false]

  return [passed, validBucket]
}

/**初始化服务端口*/
function initServer(instance, appConfig) {
  const { port, https, cors } = appConfig
  instance.port = port
  if (https && typeof https === 'object') {
    const { disabled, port, key, cert } = https
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
    if (valid) instance.https = { disabled, port, key, cert }
  }
  if (cors && typeof cors === 'object') {
    instance.cors = {}
    const { origin, credentials } = cors
    if (origin && origin instanceof String) instance.cors.origin = origin
    if (credentials === true) instance.cors.credentials = true
  }
}
/**初始化文件下载服务*/
function initFsdomain(instanceRouter, fsdomainConfig) {
  let validConfig: any = {}
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
    logger.debug('获得控制器配置：\n' + JSON.stringify(controllers, null, 2))
    instance.router = { auth, controllers, swagger, metrics }
    if (fsdomain) initFsdomain(instance.router, fsdomain)
  }
}

/* 初始化访问控制 */
async function initAuth(instance, appConfig) {
  const { auth } = appConfig
  if (!auth || auth.disabled === true) return

  const { captcha, client, jwt, redis, bucket } = auth
  const authConfig: any = {}

  /**用户认证设置*/
  if (typeof jwt === 'object' && jwt.disabled !== true) {
    let { privateKey, expiresIn } = jwt
    if (typeof privateKey === 'string') {
      authConfig.mode = 'jwt'
      authConfig.jwt = jwt
      if (!expiresIn) authConfig.jwt.expiresIn = 3600
    } else logger.warn(`启用API调用认证机制[jwt]失败，参数不完整`)
  } else if (typeof redis === 'object' && redis.disabled !== true) {
    let { host } = redis
    if (typeof host === 'string' || Array.isArray(host)) {
      try {
        await require('./redis').Context.init(redis)
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
      const { path, registerPath, npm, accounts } = client
      if (typeof npm === 'object' && npm.disabled !== true) {
        const { id, module, authentication, register } = npm
        if (typeof id !== 'string') throw Error(`通过[auth.client.npm.id]类型`)

        let createTmsClient, registerTmsClient
        if (module && typeof module === 'string') {
          if (authentication && typeof authentication === 'string') {
            createTmsClient = require(`${id}/${module}`)[authentication]
          } else {
            createTmsClient = require(`${id}/${module}`)
          }
          // 注册方法
          if (typeof register === 'string') {
            if (register) {
              registerTmsClient = require(`${id}/${module}`)[register]
            } else {
              registerTmsClient = require(`${id}/${module}`)
            }
          }
        } else {
          // 如果没有指定module 那么 authentication、register 指定的应该是一个独立的模块文件
          if (authentication && typeof authentication === 'string') {
            createTmsClient = require(`${id}/${authentication}`)
          } else {
            createTmsClient = require(id)
          }
          // 注册方法
          if (typeof register === 'string') {
            if (register) {
              registerTmsClient = require(`${id}/${register}`)
            } else {
              registerTmsClient = require(id)
            }
          }
        }
        if (typeof createTmsClient !== 'function')
          throw Error(`通过[npm=${id}]设置的用户认证外部方法的类型不是函数`)
        authConfig.client = { createTmsClient }
        // 外部注册方法
        if (registerTmsClient) {
          if (typeof registerTmsClient !== 'function')
            throw Error(`通过[npm=${id}]设置的用户注册外部方法的类型不是函数`)
          authConfig.client.registerTmsClient = registerTmsClient
        }
      } else if (typeof path === 'string') {
        /* 指定了外部认证方法 */
        const pathClient = modPath.resolve(path)
        if (!fs.existsSync(pathClient))
          throw Error('设置的用户认证外部方法不存在')
        let createTmsClient = require(pathClient)
        if (typeof createTmsClient !== 'function')
          throw Error('设置的用户认证外部方法的类型不是函数')
        authConfig.client = { createTmsClient }

        /* 指定了外部注册方法 */
        if (typeof registerPath === 'string') {
          const regPathClient = modPath.resolve(registerPath)
          if (!fs.existsSync(regPathClient))
            throw Error('设置的用户注册外部方法不存在')
          let registerTmsClient = require(regPathClient)
          if (typeof registerTmsClient !== 'function')
            throw Error('设置的用户注册外部方法的类型不是函数')
          authConfig.client.registerTmsClient = registerTmsClient
        }
      } else if (Array.isArray(accounts) && accounts.length) {
        /* 指定了本地账号 */
        authConfig.client = {
          accounts,
          createTmsClient: function (ctx) {
            return localCreateTmsClient(ctx, accounts)
          },
          registerTmsClient: function (ctx) {
            return localRegisterTmsClient(ctx, accounts)
          },
        }
      }
    }
  }
  /**验证码设置*/
  if (captcha && typeof captcha === 'object') {
    const { path, checkPath, code, npm } = captcha
    if (typeof npm === 'object' && npm.disabled !== true) {
      const { id, module, generator, checker } = npm
      if (typeof id !== 'string') throw Error(`通过[auth.captcha.npm.id]类型`)

      let createCaptcha, checkCaptcha
      if (module && typeof module === 'string') {
        if (generator && typeof generator === 'string') {
          createCaptcha = require(`${id}/${module}`)[generator]
        } else {
          createCaptcha = require(`${id}/${module}`)
        }
        // 检查验证码方法
        if (typeof checker === 'string') {
          if (checker) {
            checkCaptcha = require(`${id}/${module}`)[checker]
          } else {
            checkCaptcha = require(`${id}/${module}`)
          }
        }
      } else {
        // 如果没有指定module 那么 generator、checker 指定的应该是一个独立的模块文件
        if (generator && typeof generator === 'string') {
          createCaptcha = require(`${id}/${generator}`)
        } else {
          createCaptcha = require(id)
        }
        // 检查验证码方法
        if (typeof checker === 'string') {
          if (checker) {
            checkCaptcha = require(`${id}/${checker}`)
          } else {
            checkCaptcha = require(id)
          }
        }
      }

      if (typeof createCaptcha !== 'function')
        throw Error(`通过[npm=${id}]设置的生成验证码外部方法的类型不是函数`)
      authConfig.captcha = { createCaptcha }

      if (checkCaptcha) {
        // 检查验证码方法
        if (typeof checkCaptcha !== 'function')
          throw Error(`通过[npm=${id}]设置的检查验证码外部方法的类型不是函数`)
        authConfig.captcha.checkCaptcha = checkCaptcha
      }
    } else if (typeof path === 'string') {
      const pathCaptcha = modPath.resolve(path)
      if (!fs.existsSync(pathCaptcha))
        throw Error('未设置用验证码限制调用用户认证接口的方法')
      const fnCreateCaptcha = require(pathCaptcha)
      if (typeof fnCreateCaptcha !== 'function')
        throw Error('设置的生成验证码方法的类型不是函数')
      authConfig.captcha = { createCaptcha: fnCreateCaptcha }

      if (typeof checkPath === 'string') {
        const pathCheckCaptcha = modPath.resolve(checkPath)
        if (!fs.existsSync(pathCheckCaptcha))
          throw Error('未设置检查验证码的方法')
        const fnCheckCaptcha = require(pathCheckCaptcha)
        if (typeof fnCheckCaptcha !== 'function')
          throw Error('设置的检查验证码方法的类型不是函数')
        authConfig.captcha.checkCaptcha = fnCheckCaptcha
      }
    } else if (code && typeof code === 'string') {
      /* 指定了本地验证码 */
      authConfig.captcha = {
        code,
        createCaptcha: function (ctx) {
          return localCreateCaptcha(ctx, code)
        },
        checkCaptcha: function (ctx) {
          return localCheckCaptcha(ctx, code)
        },
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

// 全局单例
let _instance

export class Context {
  appConfig

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
    let prefix = _.get(this, ['router', 'auth', 'prefix'], 'auth')
    if (prefix && !/^\//.test(prefix)) prefix = `/${prefix}`
    return prefix
  }

  get routerAuthTrustedHosts() {
    let trustedHosts = _.get(this, ['router', 'auth', 'trustedHosts'], [])
    if (!Array.isArray(trustedHosts)) return []
    return trustedHosts
  }

  get excelDomainName() {
    return _.get(this, ['router', 'controllers', 'excel', 'outputDomain'], '')
  }
  /**
   * 根据配置数据初始化上下文对象
   * @param appConfig 配置数据
   * @returns
   */
  static async init(appConfig) {
    if (_instance) return _instance

    _instance = new Context(appConfig)

    initServer(_instance, appConfig)

    initRouter(_instance, appConfig)

    await initAuth(_instance, appConfig)

    logger.info(`完成应用基础设置。`)

    return _instance
  }

  static insSync() {
    return _instance
  }

  static ins = Context.init
}
