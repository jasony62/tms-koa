const { MongoContext } = require('tms-koa').Context
const ObjectId = require('mongodb').ObjectId

const AccountConfig = require('../config').AccountConfig
const { PasswordProcess: ProcessPwd } = require('./processpwd')

const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-koa-account-account')

/**
 * 将指定的page和size参数转换为skip和limit参互
 * @param {number} page
 * @param {number} size
 *
 * @return {object} 包含skip和limit的对象
 */
function toSkipAndLimit(page, size) {
  let skip = 0
  let limit = 0
  if (page && page > 0 && size && size > 0) {
    skip = (parseInt(page) - 1) * parseInt(size)
    limit = parseInt(size)
  }
  return { skip, limit }
}
/**
 * 账号
 */
class MongodbModel {
  cl

  constructor(mongoClient, database, collection) {
    this.cl = mongoClient.db(database).collection(collection)
  }
  /**
   * 在mongodb中保存账号
   * @param {*} newAccount
   * @returns
   */
  async create(newAccount) {
    // 加密密码
    const salt = ProcessPwd.getSalt() // 加密密钥
    const pwdProcess = new ProcessPwd(newAccount.password, salt)
    newAccount.password = pwdProcess.hash
    newAccount.salt = salt

    return this.cl.insertOne(newAccount).then(result => result)
  }
  /**
   * 创建账号
   * @param {*} userInfo
   * @returns
   */
  processAndCreate(userInfo) {
    return new Promise(async (resolve, reject) => {
      if (['password', 'username'].every((v) => userInfo[v]) === false)
        return reject('用户信息不完整')

      let {
        username: account,
        password,
        nickname,
        isAdmin,
        allowMultiLogin,
        ...other
      } = userInfo
      // 检查账号是否已存在
      const rst = await this.getAccount(account)
      if (rst) return reject('账号已存在')
      // 检查密码格式
      const pwdProcess = new ProcessPwd(password)
      pwdProcess.options = { account }
      const checkRst = pwdProcess.pwdStrengthCheck()
      if (checkRst[0] === false) return reject(checkRst[1])
      //
      let newAccount = {
        account,
        password,
        nickname,
        isAdmin: new RegExp(/^true$/).test(isAdmin) ? true : false,
        allowMultiLogin: new RegExp(/^true$/).test(allowMultiLogin)
          ? true
          : false,
        create_at: Date.now(),
      }
      // 根据mongodb存储字段要求处理用户提交数据
      let { mongodb } = AccountConfig
      if (mongodb && typeof mongodb.schema === 'object') {
        const otherData = Object.keys(other)
          .filter((key) => mongodb.schema[key])
          .reduce((res, key) => ((res[key] = other[key]), res), {})
        Object.assign(newAccount, otherData)
      }

      return await this.create(newAccount).then(r => resolve(newAccount)).catch(err => reject(err))
    })
  }

  async list({ filter = {} } = {}, { page = null, size = null } = {}) {
    let query = filter
    const options: { skip?: number, limit?: number } = {}
    // 添加分页条件
    let { skip, limit } = toSkipAndLimit(page, size)
    if (typeof skip === 'number') {
      options.skip = skip
      options.limit = limit
    }
    const accounts = await this.cl.find(query, options).toArray()

    const total = await this.cl.countDocuments(query)

    return { accounts, total }
  }

  forbid(id) {
    return this.cl
      .updateOne({ _id: ObjectId(id) }, { $set: { forbidden: true } })
      .then(({ modifiedCount }) => modifiedCount === 1)
  }

  unforbid(id) {
    return this.cl
      .updateOne({ _id: ObjectId(id) }, { $set: { forbidden: false } })
      .then(({ modifiedCount }) => modifiedCount === 1)
  }

  async updateOne(where, updata) {
    return this.cl
      .updateOne(where, { $set: updata })
      .then(({ modifiedCount }) => modifiedCount === 1)
  }

  async findOne(where) {
    return this.cl.findOne(where)
  }

  async authenticate(account, password, ctx): Promise<[boolean, number | string | void]> {
    const oAccount = await this.findOne({ account })
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
            msg += `, 账号即将被锁定。剩余次数【${parseInt(authConfig.pwdErrMaxNum) - pwdErrNum
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
  async getAccount(account) {
    return this.findOne({ account })
  }
}
/**
 * 存储在配置文件中的账号
 */
class FileModel {
  accounts

  constructor(accounts) {
    this.accounts = accounts
  }
  list() {
    return { accounts: this.accounts, total: this.accounts.length }
  }
  create(newAccount) {
    let maxId = this.accounts.reduce((maxId, account) => {
      return account.id > maxId ? account.id : maxId
    }, 0)
    newAccount.id = maxId + 1
    this.accounts.push(newAccount)
    return Promise.resolve(newAccount)
  }
  processAndCreate(newAccount) {
    const found = this.accounts.find(
      (account) => account.username === newAccount.username
    )
    if (found) {
      return Promise.reject('账号已存在')
    }
    return this.create(newAccount)
  }
  forbid(id) {
    const found = this.accounts.find((account) => (account.id = id))
    if (found) {
      found.forbidden = true
      return true
    }
    return false
  }
  unforbid(id) {
    const found = this.accounts.find((account) => (account.id = id))
    if (found) {
      found.forbidden = false
      return true
    }
    return false
  }
  authenticate(username, password) {
    /**配置文件存储账号 */
    const found = this.accounts.find(
      (account) =>
        account.username === username && account.password === password
    )

    return [!!found, found]
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

if (AccountConfig && AccountConfig.disabled !== true) {
  const { mongodb, accounts } = AccountConfig
  if (mongodb && typeof mongodb === 'object' && mongodb.disabled !== true) {
    let valid = ['name', 'database', 'collection'].reduce((result, prop) => {
      if (!mongodb[prop] || typeof mongodb[prop] !== 'string') {
        logger.warn(`配置文件中[account.mongodb.${prop}]错误`)
        return false
      }
      return result
    }, true)
    if (valid) {
      const { name, database, collection } = mongodb
      Account = new MongodbModel(
        MongoContext.mongoClientSync(name),
        database,
        collection
      )
      logger.debug('指定账号储存方式【mongodb】')
    } else {
      Account = new Proxy({}, unsupportHandler)
    }
  } else if (Array.isArray(accounts)) {
    Account = new FileModel(accounts)
    logger.debug('指定账号储存方式【File】')
  } else {
    logger.warn('配置文件[account]没有指定有效账号存储方式')
    Account = new Proxy({}, unsupportHandler)
  }
} else {
  logger.warn('没有指定账号管理配置信息，不支持账号管理')
  Account = new Proxy({}, unsupportHandler)
}

export { Account }
