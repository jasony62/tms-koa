const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-koa-auth')
const Router = require('@koa/router')
const _ = require('lodash')
const jwt = require('jsonwebtoken')

const { ResultData, ResultFault, AccessTokenFault } = require('../response')

const { AppContext } = require('../app').Context

let prefix = AppContext.insSync().routerAuthPrefix
const router = new Router({ prefix })
logger.info(`指定Auth控制器前缀：${prefix}`)

const authConfig = AppContext.insSync().auth

/**
 * 获得用户认证信息
 */
async function getTmsClient(ctx) {
  let aResult

  let clientConfig = _.get(authConfig, ['client'], {})
  const { createTmsClient } = clientConfig

  if (typeof createTmsClient === 'function')
    aResult = await createTmsClient(ctx)
  else aResult = [false, '没有指定用户认证信息']

  return aResult
}
/**
 * 获得请求中传递的access_token
 *
 * @param {*} ctx
 */
function getAccessTokenByRequest(ctx) {
  let access_token
  let { request } = ctx
  let { authorization } = ctx.header
  if (authorization && authorization.indexOf('Bearer') === 0) {
    access_token = authorization.match(/\S+$/)[0]
  } else if (request.query.access_token) {
    access_token = request.query.access_token
  } else {
    return [false, '缺少Authorization头或access_token参数']
  }

  return [true, access_token]
}
/**
 * 换取client
 */
router.all('/auth/client', async (ctx) => {
  if (!authConfig.jwt && !authConfig.redis)
    return (response.body = new ResultFault('没有指定用户认证方法'))

  const { response } = ctx
  const [success, access_token] = getAccessTokenByRequest(ctx)
  if (false === success) return (response.body = new ResultFault(access_token))

  let tmsClient
  if (authConfig.jwt) {
    let decoded = jwt.decode(access_token)
    tmsClient = require('./client').createByData(decoded)
  } else if (authConfig.redis) {
    const Token = require('./token')
    let aResult = await Token.fetch(access_token)
    if (false === aResult[0]) {
      return (response.body = new AccessTokenFault(aResult[1]))
    }
    tmsClient = aResult[1]
  }
  response.body = new ResultData(tmsClient.toPlainObject())
})
/**
 * 换取access_token
 */
router.all('/auth/authenticate', async (ctx) => {
  if (!authConfig.jwt && !authConfig.redis)
    return (response.body = new ResultFault('没有指定用户认证方法'))

  let { response } = ctx
  let [passed, tmsClient] = await getTmsClient(ctx)
  if (passed === false) {
    let msg = tmsClient ? tmsClient : '没有获得有效用户信息'
    return (response.body = new ResultFault(msg, 20012))
  }

  if (authConfig.jwt) {
    let { privateKey, expiresIn } = authConfig.jwt
    let token = jwt.sign(tmsClient.toPlainObject(), privateKey, { expiresIn })
    response.body = new ResultData({
      access_token: token,
      expire_in: expiresIn,
    })
  } else if (authConfig.redis) {
    const Token = require('./token')
    let aResult = await Token.create(tmsClient)
    if (false === aResult[0]) {
      return (response.body = new ResultFault(aResult[1], 10001))
    }

    let token = aResult[1]
    response.body = new ResultData(token)
  }
})
/**
 * 换取access_token
 * @deprecated 用/auth/authenticate代替
 */
router.all('/auth/authorize', async (ctx) => {
  if (!authConfig.jwt && !authConfig.redis)
    return (response.body = new ResultFault('没有指定用户认证方法'))

  let { response } = ctx
  let [passed, tmsClient] = await getTmsClient(ctx)
  if (passed === false) {
    let msg = tmsClient ? tmsClient : '没有获得有效用户信息'
    return (response.body = new ResultFault(msg, 20012))
  }

  if (authConfig.jwt) {
    let { privateKey, expiresIn } = authConfig.jwt
    let token = jwt.sign(tmsClient.toPlainObject(), privateKey, { expiresIn })
    response.body = new ResultData({
      access_token: token,
      expire_in: expiresIn,
    })
  } else if (authConfig.redis) {
    const Token = require('./token')
    let aResult = await Token.create(tmsClient)
    if (false === aResult[0]) {
      return (response.body = new ResultFault(aResult[1], 10001))
    }

    let token = aResult[1]
    response.body = new ResultData(token)
  }
})
/**
 * 生成的验证码
 */
router.all('/auth/captcha', async (ctx) => {
  let { response } = ctx

  let captchaConfig = _.get(authConfig, ['captcha'], {})
  if (typeof captchaConfig.createCaptcha === 'function') {
    let captcha = await captchaConfig.createCaptcha(ctx)
    if (captcha[0] === false) {
      let msg = captcha[1] ? captcha[1] : '没有获得有效的验证码'
      return (response.body = new ResultFault(msg, 40001))
    }

    captcha = captcha[1]
    return (response.body = new ResultData(captcha))
  }
  /* 指定了固定值的验证码 */
  if (typeof captchaConfig.code === 'string' && captchaConfig.code) {
    return (response.body = new ResultData(captchaConfig.code))
  }

  response.body = new ResultFault(
    '未设置用验证码限制调用用户认证接口的方法',
    20011
  )
})

module.exports = router
