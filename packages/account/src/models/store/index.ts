import { AccountConfig } from '../../config'
import { PasswordProcess as ProcessPwd } from '../processpwd'

import { MongodbModel as MongodbModelBase } from './mongodb'
import { FileModel } from './file'

import { getLogger } from '@log4js-node/log4js-api'
const logger = getLogger('tms-koa-account')

import Debug from 'debug'
const debug = Debug('tms-koa-account')

/**
 * 存储在mongodb中的账号
 */
class MongodbModel extends MongodbModelBase {
  /**
   * 账号认证
   * @param username
   * @param password
   * @param ctx
   * @returns
   */
  async authenticate(
    username,
    password,
    ctx
  ): Promise<[boolean, number | string | void]> {
    const oAccount = await this.findOne({ username })
    if (!oAccount) return [false, '账号或密码错误']
    if (oAccount.forbidden === true) return [false, '禁止登录']
    //
    const current = Date.now()
    if (oAccount.authLockExp && current < oAccount.authLockExp) {
      return [
        false,
        `登录频繁，请在${(oAccount.authLockExp - current) / 1000}秒后再次尝试`,
      ]
    }

    //可以登录检查密码
    const proPwd = new ProcessPwd(password, oAccount.salt)
    if (proPwd.compare(oAccount.password) === false) {
      let msg = '账号或密码错误'
      // 记录失败次数
      const pwdErrNum = !oAccount.pwdErrNum ? 1 : oAccount.pwdErrNum * 1 + 1
      let updata: any = { pwdErrNum }
      if (AccountConfig.authConfig) {
        const authConfig = AccountConfig.authConfig
        if (
          new RegExp(/^[1-9]\d*$/).test(authConfig.pwdErrMaxNum) &&
          new RegExp(/^[1-9]\d*$/).test(authConfig.authLockDUR)
        ) {
          if (pwdErrNum >= parseInt(authConfig.pwdErrMaxNum)) {
            // 密码错误次数超限后，账号锁定
            updata.authLockExp = current + authConfig.authLockDUR * 1000
            updata.pwdErrNum = 0
            msg += `; 账号锁定 ${parseInt(authConfig.authLockDUR)} 秒`
          } else {
            msg += `, 账号即将被锁定。剩余次数【${
              parseInt(authConfig.pwdErrMaxNum) - pwdErrNum
            }】`
          }
        }
      }
      await this.updateOne({ _id: oAccount._id }, updata)
      return [false, msg]
    }
    // 密码正确需要重置密码错误次数
    await this.updateOne(
      { _id: oAccount._id },
      {
        pwdErrNum: 0,
        authLockExp: 0,
        lastLoginTime: current,
        lastLoginIp: ctx.request.ip,
      }
    )

    const { _id, password: pwd, salt, ...newAccount } = oAccount

    return [true, newAccount]
  }
}

/**
 * 如果没有指定有效的账号管理实现时，抛异常
 */
const unsupportHandler = {
  get: function (target, prop, receiver) {
    if (['list', 'create', 'forbid', 'unforbid'].includes(prop)) {
      return function () {
        throw Error('不支持账号管理功能')
      }
    }
  },
}

let Account // 账号处理
if (!AccountConfig || typeof AccountConfig !== 'object') {
  logger.error('账号管理模块没有获取配置信息，无法启用')
  Account = new Proxy({}, unsupportHandler)
  process.exit(0)
}

if (AccountConfig.disabled === true) {
  logger.warn('账号管理模已设置为禁用，不启用')
  Account = new Proxy({}, unsupportHandler)
} else {
  logger.debug(
    '通过配置文件获取账号管理配置信息：\n' +
      JSON.stringify(AccountConfig, null, 2)
  )
  const { mongodb, accounts } = AccountConfig
  if (!mongodb && !accounts) {
    logger.error('账号管理模块没有指定账号存储方式，无法启用')
    process.exit(0)
  }
}

function createModel(tmsContext: any) {
  if (Account && typeof Account === 'object') return Account

  const { mongodb, accounts } = AccountConfig
  if (mongodb && typeof mongodb === 'object' && mongodb.disabled !== true) {
    logger.debug('指定账号储存方式【mongodb】')
    let valid = ['name', 'database', 'collection'].reduce((result, prop) => {
      if (!mongodb[prop] || typeof mongodb[prop] !== 'string') {
        logger.warn(`配置文件中[account.mongodb.${prop}]错误`)
        return false
      }
      return result
    }, true)
    if (valid) {
      const { name, database, collection } = mongodb
      const { MongoContext } = tmsContext
      if (!MongoContext) {
        logger.error(
          '没有从框架获得【mongodb】的上下文数据，创建账号管理服务失败'
        )
        process.exit(0)
      }
      Account = new MongodbModel(
        MongoContext.mongoClientSync(name),
        database,
        collection
      )
      logger.debug('完成创建账号管理服务，储存方式【mongodb】')
    } else {
      Account = new Proxy({}, unsupportHandler)
    }
  } else if (Array.isArray(accounts)) {
    Account = new FileModel(accounts)
    logger.debug('完成创建账号管理服务，储存方式【file】')
  } else {
    logger.error('账号管理模块没有指定可用的账号存储方式，无法启用')
    process.exit(0)
  }

  return Account
}

export { createModel }
