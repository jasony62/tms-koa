/**
 * 处理http请求的接口
 */
// http请求
const API_FIELD_REQUEST = Symbol('request')
// 发起调用的客户端
const API_FIELD_CLIENT = Symbol('client')
// 数据库实例上下文(DbServer)
const API_FIELD_DB_CTX = Symbol('dbcontext')
// mongodb实例上下文
const API_FIELD_MONGO_CLIENT = Symbol('mongoclient')
//
const API_FIELD_MONGOOSE = Symbol('mongoose')
//
const API_FIELD_CTX = Symbol('ctx')
//
const API_FIELD_PUSH_CTX = Symbol('pushContext')

class Ctrl {
  constructor(ctx, client, dbContext, mongoClient, mongoose, pushContext) {
    this[API_FIELD_REQUEST] = ctx.request
    this[API_FIELD_CLIENT] = client
    this[API_FIELD_DB_CTX] = dbContext
    this[API_FIELD_MONGO_CLIENT] = mongoClient
    this[API_FIELD_MONGOOSE] = mongoose
    this[API_FIELD_CTX] = ctx
    this[API_FIELD_PUSH_CTX] = pushContext
  }

  get request() {
    return this[API_FIELD_REQUEST]
  }
  get client() {
    return this[API_FIELD_CLIENT]
  }
  get dbContext() {
    return this[API_FIELD_DB_CTX]
  }
  get mongoClient() {
    return this[API_FIELD_MONGO_CLIENT]
  }
  get mongoose() {
    return this[API_FIELD_MONGOOSE]
  }
  get db() {
    return this.dbContext.db()
  }
  get ctx() {
    return this[API_FIELD_CTX]
  }
  get socket() {
    if (this[API_FIELD_PUSH_CTX] && this.request.query.socketid) {
      const { socketid } = this.request.query
      if (this.ctx.protocol === 'https')
        return this[API_FIELD_PUSH_CTX].getHttpsSocket(socketid)
      else return this[API_FIELD_PUSH_CTX].getSocket(socketid)
    }
    return null
  }
  /**
   * 加载指定的model包，传递数据库实例
   *
   * @param {string} name 模型的名称（从models目录下开始）
   */
  model(name) {
    let path = `${process.cwd()}/models/${name}`
    let model = require(path).create({ db: this.db })
    return model
  }
  /**
   * 解决mongodb日期型数据时区问题
   *
   * @param {int} ts 时间戳
   */
  localDate(ts = Date.now()) {
    let d = new Date(ts)
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
    return d
  }
}

module.exports = { Ctrl }
