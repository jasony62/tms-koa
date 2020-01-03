const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-koa-auth')
const Router = require('koa-router')
const _ = require('lodash')
const jwt = require('jsonwebtoken')

const { ResultData, ResultFault, AccessTokenFault } = require('../response')

const appConfig = require(process.cwd() + '/config/app')

// 路由前缀必须以反斜杠开头
let prefix = _.get(appConfig, ['router', 'auth', 'prefix'], '')
if (prefix && !/^\//.test(prefix)) prefix = `/${prefix}`
const router = new Router({ prefix })

/**
 * 获得用户认证信息
 */
async function getTmsClient(ctx) {
  let aResult
  let clientConfig = _.get(appConfig, ['auth', 'client'], {})
  if (typeof clientConfig.path === 'string' && clientConfig.path) {
    const fnCreateTmsClient = require(process.cwd() + clientConfig.path)
    aResult = await fnCreateTmsClient(ctx)
  } else if (
    Array.isArray(clientConfig.accounts) &&
    clientConfig.accounts.length
  ) {
    const { username, password } = ctx.request.body
    if (!username || !password) {
      aResult = [false, '没有提供用户名或密码']
    } else {
      const found = clientConfig.accounts.find(
        a => a.username === username && a.password === password
      )
      if (found) {
        const tmsClient = require('./client').createByData({
          id: found.id,
          data: { username }
        })
        aResult = [true, tmsClient]
      } else {
        logger.debug(`用户名[${username}]或密码[${password}]错误`)
        aResult = [false, '用户名或密码错误']
      }
    }
  } else {
    aResult = [false, '没有指定用户认证信息']
  }

  return aResult
}
/**
 * 换取client
 */
router.all('/auth/client', async ctx => {
  let authConfig = appConfig.auth
  if (!authConfig.jwt && !authConfig.redis)
    return (response.body = new ResultFault('没有指定用户认证方法'))

  const { request, response } = ctx
  const { access_token } = request.query
  if (!access_token) {
    return (response.body = new ResultFault('缺少access_token参数'))
  }

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
router.all('/auth/authorize', async ctx => {
  let authConfig = appConfig.auth
  if (!authConfig.jwt && !authConfig.redis)
    return (response.body = new ResultFault('没有指定用户认证方法'))

  let { response } = ctx
  let tmsClient = await getTmsClient(ctx)
  if (tmsClient[0] === false) {
    let msg = tmsClient[1] ? tmsClient[1] : '没有获得有效用户信息'
    return (response.body = new ResultFault(msg, 20012))
  }
  tmsClient = tmsClient[1] // 用户信息

  if (authConfig.jwt) {
    let { privateKey, expiresIn } = appConfig.auth.jwt
    let token = jwt.sign(tmsClient.toPlainObject(), privateKey, { expiresIn })
    response.body = new ResultData({
      access_token: token,
      expire_in: expiresIn
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
router.all('/auth/captcha', async ctx => {
  let { response } = ctx

  let captchaConfig = _.get(appConfig, ['auth', 'captcha'], {})
  if (typeof captchaConfig.path === 'string' && captchaConfig.path) {
    const fs = require('fs')
    const pathCaptcha = process.cwd() + captchaConfig.path
    if (!fs.existsSync(pathCaptcha)) {
      return (response.body = new ResultFault(
        '未设置用验证码限制调用用户认证接口的方法',
        20011
      ))
    }
    const fnCreateCaptcha = require(pathCaptcha)
    let captcha = await fnCreateCaptcha(ctx)
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
/**
 * 换取token
 * @deprecated 用/auth/authorize代替
 */
router.all('/auth/token', async ctx => {
  let { response } = ctx
  let tmsClient = await getTmsClient(ctx)
  if (tmsClient[0] === false) {
    let msg = tmsClient[1] ? tmsClient[1] : '没有获得有效用户信息'
    return (response.body = new ResultFault(msg, 20012))
  }

  tmsClient = tmsClient[1]
  const Token = require('./token')
  let aResult = await Token.create(tmsClient)
  if (false === aResult[0]) {
    return (response.body = new ResultFault(aResult[1], 10001))
  }

  let token = aResult[1]
  response.body = new ResultData(token)
})

module.exports = router
