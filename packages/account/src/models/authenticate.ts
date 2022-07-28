const { Client } = require('tms-koa')
const { AccountConfig } = require('../config')
const { captchaConfig: CaptchaConfig } = AccountConfig
const { checkCaptcha } = require("../models/captcha")
const PATH = require("path")
const fs = require("fs")

const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-koa-account-authenticate')

/**
 * 根据http请求中包含的信息获得用户数据，支持异步调用
 */
export = async function (ctx) {
  const { Account } = require('./account')
  let { username, password } = ctx.request.body

  // 账号、密码前置处理
  if (AccountConfig.accountBeforeEach) {
    let func
    if (typeof AccountConfig.accountBeforeEach === 'string') {
      const funcPath = PATH.resolve(AccountConfig.accountBeforeEach)
      if (fs.existsSync(funcPath)) func = require(funcPath)
    } else if (typeof AccountConfig.accountBeforeEach === 'function') {
      func = AccountConfig.accountBeforeEach
    }
    try {
      let rst = await func(ctx)
      username = rst.username
      password = rst.password
    } catch (error) {
      logger.error(error)
      return [false, error.message ? error.message : error.toString()]
    }
  }

  if (AccountConfig && AccountConfig.disabled !== true) {
    const { admin } = AccountConfig
    /**指定管理员账号 */
    if (admin && typeof admin === 'object') {
      if (admin.username === username && admin.password === password) {
        let tmsClient = new Client(username, { username }, true)
        return [true, tmsClient]
      }
    }
    // 验证码
    if (!CaptchaConfig || CaptchaConfig.disabled !== true) {
      const rst = await checkCaptcha(ctx)
      if (rst[0] === false)
        return rst
    }
    /**mongodb存储账号 */
    let found = await Account.authenticate(username, password, ctx)
    if (found[0] === true) {
      found = found[1]
      let tmsClient = new Client(
        username,
        found,
        found.isAdmin === true,
        found.allowMultiLogin === true
      )
      return [true, tmsClient]
    } else return [false, found[1]]
  }

  return [false, '没有找到匹配的账号']
}
