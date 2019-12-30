const Router = require('koa-router')
const _ = require('lodash')
const jwt = require('jsonwebtoken')

const { ResultData, ResultFault, AccessTokenFault } = require('../response')
const Token = require('./token')

const appConfig = require(process.cwd() + '/config/app')
let prefix = _.get(appConfig, ['router', 'auth', 'prefix'], '')
// 前缀必须以反斜杠开头
if (prefix && !/^\//.test(prefix)) prefix = `/${prefix}`
const router = new Router({ prefix })
/**
 * 换取token
 */
router.all('/auth/token', async ctx => {
  let { response } = ctx
  const fnCreateTmsClient = require(process.cwd() + '/auth/client.js')
  let tmsClient = await fnCreateTmsClient(ctx)
  if (tmsClient[0] === false) {
    let msg = tmsClient[1] ? tmsClient[1] : '没有获得有效用户信息'
    return (response.body = new ResultFault(msg, 20012))
  }

  tmsClient = tmsClient[1]
  let aResult = await Token.create(tmsClient)
  if (false === aResult[0]) {
    return (response.body = new ResultFault(aResult[1], 10001))
  }

  let token = aResult[1]
  response.body = new ResultData(token)
})
/**
 * 换取jwt
 */
router.all('/oauth/authorize', async ctx => {
  let { response } = ctx
  const fnCreateTmsClient = require(process.cwd() + '/auth/client.js')
  let tmsClient = await fnCreateTmsClient(ctx)
  if (tmsClient[0] === false) {
    let msg = tmsClient[1] ? tmsClient[1] : '没有获得有效用户信息'
    return (response.body = new ResultFault(msg, 20012))
  }
  tmsClient = tmsClient[1] // 用户信息

  let { privateKey, expiresIn } = appConfig.jwt
  let token = jwt.sign(tmsClient.toPlainObject(), privateKey, { expiresIn })
  response.body = new ResultData(token)
})
/**
 * 换取client
 */
router.all('/auth/client', async ctx => {
  const { request, response } = ctx
  const { access_token } = request.query
  if (!access_token) {
    return (response.body = new ResultFault('缺少access_token参数'))
  }
  let aResult = await Token.fetch(access_token)
  if (false === aResult[0]) {
    return (response.body = new AccessTokenFault(aResult[1]))
  }
  const tmsClient = aResult[1]

  response.body = new ResultData(tmsClient.toPlainObject())
})
/**
 * 生成的验证码
 */
router.all('/auth/captcha', async ctx => {
  let { response } = ctx
  const fs = require('fs')
  const pathCaptcha = process.cwd() + '/auth/captcha.js'
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
  response.body = new ResultData(captcha)
})

module.exports = router
