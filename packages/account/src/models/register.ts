import { AccountConfig } from '../config.js'
import PATH from 'path'
import fs from 'fs'

import { getLogger } from '@log4js-node/log4js-api'
const logger = getLogger('tms-koa-account')

import { createModel } from './store/index.js'

/**
 * 根据http请求中包含的信息获得用户数据，支持异步调用
 */
export async function registerTmsClient(
  ctx: any,
  tmsContext: any,
  checkCaptcha?: Function
) {
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
    if (checkCaptcha && typeof checkCaptcha === 'function') {
      const rst = await checkCaptcha(ctx)
      if (rst[0] === false) return rst
    }
    let Model = createModel(tmsContext)
    /* 存储账号 */
    return Model.processAndCreate(userInfo)
      .then((r) => [true, r])
      .catch((err) => [false, err.toString()])
  }

  return [false, '禁用账号管理功能']
}

export default registerTmsClient
