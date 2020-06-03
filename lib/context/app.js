const _ = require('lodash')
const fs = require('fs')
const path = require('path')
const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-koa-app')

/**
 * 返回当前用户，当前请求对应的bucket
 *
 * @param {*} client
 * @param {*} request
 */
async function checkClientBucket(client, request) {
  const { bucket } = request

  if (!this.bucketValidator) return [true, bucket ? bucket : '']

  const result = await this.bucketValidator(client, request)

  if (!Array.isArray(result)) return [false]

  let [passed, validBucket] = result

  if (passed !== true || typeof validBucket !== 'string') return [false]

  return [passed, validBucket]
}

/* 初始化端口 */
function initServer(instance, appConfig) {
  instance.port = appConfig.port
  if (appConfig.https && typeof appConfig.https === 'object') {
    const { port, key, cert } = appConfig.https
    let valid = true
    if (!parseInt(port)) {
      logger.warn('指定的https服务端口不可用')
      valid = false
    }
    if (!fs.existsSync(key)) {
      logger.warn('指定的https服务key文件不存在')
      valid = false
    }
    if (!fs.existsSync(cert)) {
      logger.warn('指定的https服务cert文件不存在')
      valid = false
    }
    if (valid) instance.https = { port, key, cert }
  }
}
/* 初始化文件下载服务 */
function initFsdomain(instance, fsdomainConfig) {
  let { prefix } = fsdomainConfig
  if (prefix && typeof prefix === 'string') {
    if (prefix[0] !== '/') prefix = `/${prefix}`
    instance.prefix = prefix
  }
}
/* 初始化控制器路由 */
function initRouter(instance, appConfig) {
  if (appConfig.router) {
    const { auth, controllers, fsdomain } = appConfig.router
    instance.router = { auth, controllers }
    if (fsdomain) initFsdomain(instance.router, fsdomainConfig)
  }
}

/* 初始化认证 */
function initAuth(instance, appConfig) {
  const { auth } = appConfig
  if (auth && auth.disabled !== true) {
    const { captcha, client, jwt, redis, bucket } = auth
    const cleanedAuth = {}
    if (jwt) {
      cleanedAuth.jwt = jwt
    } else if (redia) {
      cleanedAuth.redis = redis
    }
    if (cleanedAuth.jwt || cleanedAuth.redis) {
      if (client) {
        cleanedAuth.client = client
      }
      if (captcha) {
        cleanedAuth.captcha = captcha
      }
      if (bucket && bucket.validator) {
        let validatorPath = path.resolve(bucket.validator)
        try {
          const validator = require(validatorPath)
          if (typeof validator === 'function') {
            instance.bucketValidator = validator
            instance.checkClientBucket = checkClientBucket
            logger.info('指定了bucket验证函数')
          } else {
            logger.warn(
              `指定的bucket验证模块[${bucket.validator}]返回的不是函数`
            )
          }
        } catch (e) {
          logger.warn(`指定的bucket验证模块[${bucket.validator}]不存在`)
        }
      }
    }

    instance.auth = cleanedAuth
  }
}

class Context {
  get excelDomainName() {
    return _.get(
      appConfig,
      ['router', 'controllers', 'excel', 'outputDomain'],
      ''
    )
  }
}

Context.init = (function () {
  let _instance
  return async function (appConfig) {
    if (_instance) return _instance

    _instance = new Context()

    initServer(_instance, appConfig)

    initRouter(_instance, appConfig)

    initAuth(_instance, appConfig)

    Context.insSync = function () {
      return _instance
    }

    logger.info(`完成应用基础设置。`)

    return _instance
  }
})()
Context.ins = Context.init

module.exports = { Context }
