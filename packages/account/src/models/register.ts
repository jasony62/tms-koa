const { Client } = require('tms-koa')
const { checkCaptcha } = require("../models/captcha")
const { AccountConfig } = require('../config')
const { captchaConfig: CaptchaConfig } = AccountConfig
const PATH = require('path')
const fs = require('fs')

const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-koa-account-register')

/**
 * 根据http请求中包含的信息获得用户数据，支持异步调用
 */
export = async (ctx) => {
  const { Account } = require('./account')
  let userInfo = ctx.request.body

  // 账号、密码前置处理
  if (AccountConfig.accountBeforeEach) {
    let func
    if (typeof AccountConfig.accountBeforeEach === 'string') {
      const funcPath = PATH.resolve(AccountConfig.accountBeforeEach)
      if (fs.existsSync(funcPath)) func = require(funcPath)
    } else if (typeof AccountConfig.accountBeforeEach === 'function') {
      func = AccountConfig.accountBeforeEach
    }
    if (func) {
      try {
        let userInfo2 = await func(ctx)
        Object.assign(userInfo, userInfo2)
      } catch (error) {
        logger.error(error)
        return [false, error.message ? error.message : error.toString()]
      }
    }
  }

  if (AccountConfig && AccountConfig.disabled !== true) {
    const { admin } = AccountConfig
    /**指定管理员账号 */
    if (admin && typeof admin === 'object') {
      if (admin.username === userInfo.username) {
        return [false, '账号已存在']
      }
    }
    // 验证码
    if (!CaptchaConfig || CaptchaConfig.disabled !== true) {
      const rst = await checkCaptcha(ctx)
      if (rst[0] === false)
        return rst
    }

    /* 存储账号 */
    return Account.processAndCreate(userInfo)
      .then((r) => [true, r])
      .catch((err) => [false, err.toString()])
  }

  return [false, "禁用账号管理功能"]
}
