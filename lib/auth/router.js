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
    response.body = new ResultFault(msg, 20012)
    return
  }

  tmsClient = tmsClient[1]
  let aResult = await Token.create(tmsClient)
  if (false === aResult[0]) {
    response.body = new ResultFault(aResult[1], 10001)
    return
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
    response.body = new ResultFault(msg, 20012)
    return
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
    response.body = new ResultFault('缺少access_token参数')
    return
  }
  let aResult = await Token.fetch(access_token)
  if (false === aResult[0]) {
    response.body = new AccessTokenFault(aResult[1])
    return
  }
  const tmsClient = aResult[1]

  response.body = new ResultData(tmsClient.toPlainObject())
})
/**
 * 生成调用获取access_token的验证信息
 */
router.all('/auth/captcha', async ctx => {
  const fs = require('fs')
  if (!fs.existsSync(process.cwd() + '/auth/captcha.js'))
    return new ResultFault('未对调用鉴权接口设置验证信息', 20011)

  let { response } = ctx

  const fnCreateCaptcha = require(process.cwd() + '/auth/captcha.js')
  let captcha = await fnCreateCaptcha(ctx)
  if (captcha[0] === false) {
    let msg = captcha[1] ? captcha[1] : '没有获得有效验证信息'
    response.body = new ResultFault(msg, 40001)
    return
  }

  captcha = captcha[1]
  response.body = new ResultData(captcha)
})

module.exports = router
