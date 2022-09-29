import { ObjectId } from 'mongodb'

import { PasswordProcess as ProcessPwd } from '../processpwd'

import Debug from 'debug'
const debug = Debug('tms-koa-account')

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
    try {
      // 加密密码
      const salt = ProcessPwd.getSalt() // 加密密钥
      const pwdProcess = new ProcessPwd(newAccount.password, salt)
      newAccount.password = pwdProcess.hash
      newAccount.salt = salt
      return this.cl.insertOne(newAccount).then((result) => result)
    } catch (e) {
      debug('创建账号时发送异常', e)
      throw e
    }
  }
  /**
   * 创建账号
   * @param {*} userInfo
   * @returns
   */
  processAndCreate(userInfo, options = { jumpPwdCheck: false }) {
    return new Promise(async (resolve, reject) => {
      if (['password', 'username'].every((v) => userInfo[v]) === false)
        return reject('用户信息不完整')

      let { username, password, nickname, isAdmin, allowMultiLogin, ...other } =
        userInfo

      // 检查账号是否已存在
      const rst = await this.getAccount(username)
      if (rst) {
        debug(`账号【${username}】已存在`)
        return reject('账号已存在')
      }

      // 检查密码格式
      const pwdProcess = new ProcessPwd(password)
      pwdProcess.options = { username }

      if (options.jumpPwdCheck !== true) {
        const checkRst = pwdProcess.pwdStrengthCheck()
        if (checkRst[0] === false) {
          debug('未通过密码检查')
          return reject(checkRst[1])
        }
      }

      //
      let newAccount = {
        username,
        password,
        nickname,
        isAdmin: new RegExp(/^true$/).test(isAdmin) ? true : false,
        allowMultiLogin: new RegExp(/^true$/).test(allowMultiLogin)
          ? true
          : false,
        create_at: Date.now(),
        ...other,
      }

      // 根据mongodb存储字段要求处理用户提交数据
      // let { mongodb } = AccountConfig
      // if (mongodb && typeof mongodb.schema === 'object') {
      //   const otherData = Object.keys(other)
      //     .filter((key) => mongodb.schema[key])
      //     .reduce((res, key) => ((res[key] = other[key]), res), {})
      //   Object.assign(newAccount, otherData)
      // }

      return this.create(newAccount)
        .then((r) => resolve(newAccount))
        .catch((err) => reject(err))
    })
  }

  async list({ filter = {} } = {}, { page = null, size = null } = {}) {
    let query = filter
    const options: { skip?: number; limit?: number } = {}
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
      .updateOne({ _id: new ObjectId(id) }, { $set: { forbidden: true } })
      .then(({ modifiedCount }) => modifiedCount === 1)
  }

  unforbid(id) {
    return this.cl
      .updateOne({ _id: new ObjectId(id) }, { $set: { forbidden: false } })
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

  async getAccount(username: string) {
    return this.findOne({ username })
  }
}

export { MongodbModel }
