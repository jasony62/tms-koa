import { Client } from 'tms-koa'
import { AccountConfig } from '../config'
import * as PATH from 'path'
import * as fs from 'fs'

import { createModel } from './store'

import { getLogger } from '@log4js-node/log4js-api'
const logger = getLogger('tms-koa-account')

/**
 * 根据http请求中包含的信息获得用户数据，支持异步调用
 */
export async function createTmsClient(
  ctx: any,
  tmsContext: any,
  checkCaptcha?: Function
) {
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
    if (checkCaptcha && typeof checkCaptcha === 'function') {
      const rst = await checkCaptcha(ctx)
      if (rst[0] === false) return rst
    }
    /**mongodb存储账号 */
    let Model = createModel(tmsContext)
    let [exist, found] = await Model.authenticate(username, password, ctx)
    if (exist === true) {
      let tmsClient = new Client(
        username,
        found,
        found.isAdmin === true,
        found.allowMultiLogin === true
      )
      return [true, tmsClient]
    } else return [false, found]
  }

  return [false, '没有找到匹配的账号']
}

export default createTmsClient
