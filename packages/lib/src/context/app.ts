import fs from 'fs'
import modPath from 'path'
import log4js from '@log4js-node/log4js-api'
import Debug from 'debug'
import { AuthConfigCaptchaInf, AuthConfigInf } from '../types/auth/index.js'

const logger = log4js.getLogger('tms-koa-app')
const debug = Debug('tms-koa:app:context')
/**
 * 使用配置文件中指定的账号用于请求认证
 * @param {*} ctx
 */
async function localCreateTmsClient(ctx, accounts) {
  const authConfig = Context.insSync().auth
  let captchaConfig: AuthConfigCaptchaInf = authConfig?.captcha ?? {}

  /**检查验证码*/
  if (captchaConfig.disabled !== true) {
    const { checkCaptcha } = captchaConfig
    if (typeof checkCaptcha === 'function') {
      let cResult = await checkCaptcha(ctx)
      if (cResult[0] === false) return cResult
    } else return [false, '没有指定验证码检查程序']
  }

  let aResult
  const { username, password } = ctx.request.body
  if (!username || !password) {
    aResult = [false, '没有提供用户名或密码']
  } else {
    const found = accounts.find(
      (a) => a.username === username && a.password === password
    )
    if (found) {
      let data = JSON.parse(JSON.stringify(found))
      delete data.id
      delete data.password
      delete data.isAdmin
      delete data.allowMultiLogin
      const tmsClient = (await import('../auth/client.js')).createByData({
        id: found.id,
        data,
        isAdmin: found.isAdmin === true,
        allowMultiLogin: found.allowMultiLogin === true,
        expiresIn: parseInt(found.expiresIn),
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
  let captchaConfig = authConfig?.captcha ?? {}

  /**检查验证码*/
  if (captchaConfig.disabled !== true) {
    const { checkCaptcha } = captchaConfig
    if (typeof checkCaptcha === 'function') {
      let cResult = await checkCaptcha(ctx)
      if (cResult[0] === false) return cResult
    } else return [false, '没有指定验证码检查程序']
  }

  const userInfo = ctx.request.body
  accounts.push(userInfo)
  return [true, userInfo]
}
/**
 *
 * @param ctx
 * @param accounts
 */
async function localLogoutTmsClient() {}
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
  // 嵌入模式有可能没有用户信息
  // if (!client) throw Error('没有提供账号信息，无法进行bucket检查')
  const { bucket } = ctx.request.query
  /**
   * 如果指定的本地账号中包含bucket信息，使用账号携带的信息
   */
  if (typeof Context.insSync().auth.client === 'object' && client) {
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
/**
 * 初始化文件下载服务
 */
function initFsdomain(instanceRouter, fsdomainConfig) {
  let validConfig: any = {}
  let { prefix } = fsdomainConfig
  if (prefix && typeof prefix === 'string') {
    if (prefix[0] !== '/') prefix = `/${prefix}`
    validConfig.prefix = prefix
  } else {
    logger.warn(`文件服务没有指定访问文件的起始地址【router.fsdomian.prefix】`)
  }
  if (Object.keys(validConfig).length) instanceRouter.fsdomain = validConfig
}

/**
 * 初始化控制器路由
 */
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

  const { captcha, client, jwt, redis, token, bucket } = auth
  const authConfig: Partial<AuthConfigInf> = {}
  /**指定的accesstoken*/
  if (token && typeof token === 'object' && Object.keys(token).length) {
    authConfig.token = token
  }
  /**用户认证结果保存机制设置 */
  if (jwt && typeof jwt === 'object' && jwt.disabled !== true) {
    let { privateKey, expiresIn } = jwt
    if (typeof privateKey === 'string') {
      authConfig.mode = 'jwt'
      authConfig.jwt = jwt
      if (!expiresIn) authConfig.jwt.expiresIn = 3600
      let msg = `启用API调用认证机制[jwt]`
      logger.info(msg)
      debug(msg)
    } else {
      let msg = `启用API调用认证机制[jwt]失败，参数不完整`
      logger.warn(msg)
      debug(msg)
    }
  } else if (redis && typeof redis === 'object' && redis.disabled !== true) {
    let { host } = redis
    if (typeof host === 'string' || Array.isArray(host)) {
      try {
        ;(await import('./redis.js')).Context.init(redis)
        authConfig.mode = 'redis'
        authConfig.redis = redis
        let logMsg = `启用API调用认证机制[redis]`
        debug(logMsg)
      } catch (e) {
        let logMsg = `启用API调用认证机制[redis]失败，${e.message}`
        logger.isDebugEnabled() ? logger.debug(logMsg, e) : logger.warn(logMsg)
      }
    } else logger.warn(`启用API调用认证机制[redis]失败，参数不完整`)
  }
  if (authConfig.mode) {
    if (client && typeof client === 'object') {
      const { path, registerPath, logoutPath, npm, accounts } = client
      if (typeof npm === 'object' && npm.disabled !== true) {
        logger.debug('客户端认证使用npm包')
        const {
          id,
          module,
          authentication,
          register,
          logout,
          node_modules_root,
        } = npm
        if (typeof id !== 'string') throw Error(`通过[auth.client.npm.id]类型`)
        const moduleSpecifier =
          (node_modules_root ? `${node_modules_root}/node_modules/` : '') +
          `${id}/${module}`
        let createTmsClient, registerTmsClient, logoutTmsClient
        if (module && typeof module === 'string') {
          if (authentication && typeof authentication === 'string') {
            createTmsClient = (await import(moduleSpecifier))[authentication]
          } else {
            createTmsClient = await import(moduleSpecifier)
          }
          // 注册方法
          if (typeof register === 'string') {
            if (register) {
              registerTmsClient = (await import(moduleSpecifier))[register]
            } else {
              registerTmsClient = await import(moduleSpecifier)
            }
          }
          // 登出方法
          if (typeof logout === 'string') {
            if (logout) {
              logoutTmsClient = (await import(moduleSpecifier))[logout]
            } else {
              logoutTmsClient = await import(moduleSpecifier)
            }
          }
        } else {
          const moduleSpecifier =
            (node_modules_root ? `${node_modules_root}/node_modules/` : '') +
            `${id}`
          // 如果没有指定module 那么 authentication、register 指定的应该是一个独立的模块文件
          if (authentication && typeof authentication === 'string') {
            createTmsClient = await import(
              `${moduleSpecifier}/${authentication}`
            )
            debug(`使用【${moduleSpecifier}/${authentication}】作为认证方法`)
          } else {
            createTmsClient = await import(moduleSpecifier)
            debug(`使用【${id}】作为认证方法`)
          }
          if (typeof createTmsClient.default === 'function') {
            createTmsClient = createTmsClient.default
          }
          // 注册方法
          if (typeof register === 'string') {
            if (register) {
              registerTmsClient = await import(`${moduleSpecifier}/${register}`)
            } else {
              registerTmsClient = await import(moduleSpecifier)
            }
            if (typeof registerTmsClient.default === 'function') {
              registerTmsClient = registerTmsClient.default
            }
          }
          // 登出方法
          if (typeof logout === 'string') {
            if (logout) {
              logoutTmsClient = await import(`${moduleSpecifier}/${logout}`)
            } else {
              logoutTmsClient = await import(moduleSpecifier)
            }
            if (typeof logoutTmsClient.default === 'function') {
              logoutTmsClient = logoutTmsClient.default
            }
          }
        }
        if (typeof createTmsClient !== 'function')
          throw Error(`通过[npm=${id}]设置的用户认证外部方法的类型不是函数`)
        authConfig.client = { createTmsClient }
        // 注册方法
        if (registerTmsClient) {
          if (typeof registerTmsClient !== 'function')
            throw Error(`通过[npm=${id}]设置的用户注册外部方法的类型不是函数`)
          authConfig.client.registerTmsClient = registerTmsClient
        }
        // 登出方法
        if (logoutTmsClient) {
          if (typeof logoutTmsClient !== 'function')
            throw Error(`通过[npm=${id}]设置的用户注册外部方法的类型不是函数`)
          authConfig.client.logoutTmsClient = logoutTmsClient
        }
      } else if (path && typeof path === 'string') {
        logger.debug(`客户端认证使用path=${path}`)
        /* 指定了外部认证方法 */
        const pathClient = modPath.resolve(path)
        if (!fs.existsSync(pathClient))
          throw Error('设置的用户认证外部方法不存在')
        let createTmsClient = await import(pathClient)
        // 获得指定的方法
        if (createTmsClient.createTmsClient)
          createTmsClient = createTmsClient.createTmsClient
        else if (createTmsClient.default)
          createTmsClient = createTmsClient.default

        if (typeof createTmsClient !== 'function')
          throw Error('设置的用户认证外部方法的类型不是函数')
        authConfig.client = { createTmsClient }

        /* 指定了外部注册方法 */
        if (registerPath && typeof registerPath === 'string') {
          const regPathClient = modPath.resolve(registerPath)
          if (!fs.existsSync(regPathClient))
            throw Error('设置的用户注册外部方法不存在')
          let registerTmsClient = await import(regPathClient)

          // 获得指定的方法
          if (registerTmsClient.registerTmsClient)
            registerTmsClient = registerTmsClient.registerTmsClient
          else if (registerTmsClient.default)
            registerTmsClient = registerTmsClient.default

          if (typeof registerTmsClient !== 'function')
            throw Error('设置的用户注册外部方法的类型不是函数')
          authConfig.client.registerTmsClient = registerTmsClient
        }
        /* 指定了外部注册方法 */
        if (logoutPath && typeof logoutPath === 'string') {
          const logoutPathClient = modPath.resolve(logoutPath)
          if (!fs.existsSync(logoutPathClient))
            throw Error('设置的用户登出外部方法不存在')
          let logoutTmsClient = await import(logoutPathClient)
          // 获得指定的方法
          if (logoutTmsClient.logoutTmsClient)
            logoutTmsClient = logoutTmsClient.logoutTmsClient
          else if (logoutTmsClient.default)
            logoutTmsClient = logoutTmsClient.default

          if (typeof logoutTmsClient !== 'function')
            throw Error('设置的用户登出外部方法的类型不是函数')
          authConfig.client.logoutTmsClient = logoutTmsClient
        }
      } else if (Array.isArray(accounts) && accounts.length) {
        logger.debug(`客户端认证使用accounts`)
        /* 指定了本地账号 */
        authConfig.client = {
          accounts,
          createTmsClient: function (ctx) {
            return localCreateTmsClient(ctx, accounts)
          },
          registerTmsClient: function (ctx) {
            return localRegisterTmsClient(ctx, accounts)
          },
          logoutTmsClient: function (ctx) {
            return localLogoutTmsClient()
          },
        }
      }
    }
  }
  /**验证码设置*/
  if (captcha && typeof captcha === 'object') {
    const { disabled, path, checkPath, code, npm } = captcha
    if (disabled === true) {
      authConfig.captcha = { disabled: true }
    } else if (npm && typeof npm === 'object' && npm.disabled !== true) {
      const { id, module, generator, checker, node_modules_root } = npm
      if (typeof id !== 'string') throw Error(`通过[auth.captcha.npm.id]类型`)

      let createCaptcha, checkCaptcha
      if (module && typeof module === 'string') {
        const moduleSpecifier =
          (node_modules_root ? `${node_modules_root}/node_modules/` : '') +
          `${id}/${module}`
        if (generator && typeof generator === 'string')
          createCaptcha = (await import(moduleSpecifier))[generator]
        else createCaptcha = await import(moduleSpecifier)
        // 检查验证码方法
        if (typeof checker === 'string') {
          if (checker) checkCaptcha = (await import(moduleSpecifier))[checker]
          else checkCaptcha = await import(moduleSpecifier)
        }
      } else {
        const moduleSpecifier =
          (node_modules_root ? `${node_modules_root}/node_modules/` : '') +
          `${id}`
        // 如果没有指定module 那么 generator、checker 指定的应该是一个独立的模块文件
        if (generator && typeof generator === 'string')
          createCaptcha = await import(`${moduleSpecifier}/${generator}`)
        else createCaptcha = await import(moduleSpecifier)
        // 检查验证码方法
        if (typeof checker === 'string') {
          if (checker)
            checkCaptcha = await import(`${moduleSpecifier}/${checker}`)
          else checkCaptcha = await import(moduleSpecifier)
        }
      }

      if (typeof createCaptcha !== 'function')
        throw Error(`通过[npm=${id}]设置的生成验证码外部方法的类型不是函数`)
      authConfig.captcha = { disabled: false, mode: 'npm', createCaptcha }

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
      const fnCreateCaptcha = await import(pathCaptcha)
      if (typeof fnCreateCaptcha !== 'function')
        throw Error('设置的生成验证码方法的类型不是函数')
      authConfig.captcha = {
        disabled: false,
        mode: 'path',
        createCaptcha: fnCreateCaptcha,
      }

      if (typeof checkPath === 'string') {
        const pathCheckCaptcha = modPath.resolve(checkPath)
        if (!fs.existsSync(pathCheckCaptcha))
          throw Error('未设置检查验证码的方法')
        const fnCheckCaptcha = await import(pathCheckCaptcha)
        if (typeof fnCheckCaptcha !== 'function')
          throw Error('设置的检查验证码方法的类型不是函数')
        authConfig.captcha.checkCaptcha = fnCheckCaptcha
      }
    } else if (code && typeof code === 'string') {
      /* 指定了本地验证码 */
      authConfig.captcha = {
        disabled: false,
        mode: 'code',
        code,
        createCaptcha: function (ctx) {
          return localCreateCaptcha(ctx, code)
        },
        checkCaptcha: function (ctx) {
          return localCheckCaptcha(ctx, code)
        },
      }
    } else {
      authConfig.captcha = { disabled: true }
    }
  }
  if (bucket && bucket.validator) {
    if (typeof bucket.validator === 'string') {
      let validatorPath = modPath.resolve(bucket.validator)
      try {
        const validator = await import(validatorPath)
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
  /**
   * 路由配置信息
   */
  router?: any
  constructor(appConfig) {
    this.appConfig = appConfig
  }

  get routerControllersPrefix() {
    let prefix = this?.router?.controllers?.prefix ?? ''
    if (prefix && !/^\//.test(prefix)) prefix = `/${prefix}`
    return prefix
  }

  get routerAuthPrefix() {
    // 路由前缀必须以反斜杠开头
    let prefix = this?.router?.auth?.prefix ?? 'auth'
    if (prefix && !/^\//.test(prefix)) prefix = `/${prefix}`
    return prefix
  }

  get routerAuthTrustedHosts() {
    let trustedHosts = this?.router?.auth?.trustedHosts ?? []
    if (!Array.isArray(trustedHosts)) return []
    return trustedHosts
  }

  get excelDomainName() {
    return this.router?.controllers?.excel?.outputDomain ?? ''
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

    let msg = `完成应用基础设置。`
    logger.info(msg)
    debug(msg)

    return _instance
  }

  static insSync() {
    return _instance
  }

  static ins = Context.init
}
