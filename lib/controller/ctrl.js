/**
 * 处理http请求的接口
 */
// http请求
const API_FIELD_REQUEST = Symbol('request')
// 发起调用的客户端
const API_FIELD_CLIENT = Symbol('client')
// 数据库实例上下文(DbServer)
const API_FIELD_DB_CTX = Symbol('dbcontext')

class Ctrl {
  constructor(request, client, dbContext) {
    this[API_FIELD_REQUEST] = request
    this[API_FIELD_CLIENT] = client
    this[API_FIELD_DB_CTX] = dbContext
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
  get db() {
    return this.dbContext.db()
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
}

module.exports = { Ctrl }
