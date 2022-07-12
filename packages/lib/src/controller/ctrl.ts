/**
 * 处理http请求的接口
 */
// 应用上下文
const CTRL_FIELD_CTX = Symbol('ctx')
// http请求
const CTRL_FIELD_REQUEST = Symbol('request')
// 发起调用的客户端
const CTRL_FIELD_CLIENT = Symbol('client')
// 数据库实例上下文(DbServer)
const CTRL_FIELD_DB_CTX = Symbol('dbcontext')
// mongodb实例上下文
const CTRL_FIELD_MONGO_CLIENT = Symbol('mongoclient')
// 推送服务上下文
const CTRL_FIELD_PUSH_CTX = Symbol('pushContext')
// 用户空间名称
const CTRL_FIELD_BUCKET_NAME = Symbol('bucket')

/**
 * 控制器基类
 */
export abstract class Ctrl {
  constructor(ctx, client, dbContext, mongoClient, pushContext) {
    this[CTRL_FIELD_REQUEST] = ctx.request
    this[CTRL_FIELD_CLIENT] = client
    this[CTRL_FIELD_DB_CTX] = dbContext
    this[CTRL_FIELD_MONGO_CLIENT] = mongoClient
    this[CTRL_FIELD_CTX] = ctx
    this[CTRL_FIELD_PUSH_CTX] = pushContext
  }

  get request() {
    return this[CTRL_FIELD_REQUEST]
  }
  get client() {
    return this[CTRL_FIELD_CLIENT]
  }
  get dbContext() {
    return this[CTRL_FIELD_DB_CTX]
  }
  get mongoClient() {
    return this[CTRL_FIELD_MONGO_CLIENT]
  }
  get db() {
    return this.dbContext.db()
  }
  get ctx() {
    return this[CTRL_FIELD_CTX]
  }
  get socket() {
    if (this[CTRL_FIELD_PUSH_CTX] && this.request.query.socketid) {
      const { socketid } = this.request.query
      if (this.ctx.protocol === 'https')
        return this[CTRL_FIELD_PUSH_CTX].getHttpsSocket(socketid)
      else return this[CTRL_FIELD_PUSH_CTX].getSocket(socketid)
    }
    return null
  }
  get bucket() {
    return this[CTRL_FIELD_BUCKET_NAME]
  }
  set bucket(name) {
    this[CTRL_FIELD_BUCKET_NAME] = name
  }
  /**
   * 指定控制器方法白名单
   * 返回的是方法名的数组。数组内的方法不进行权限检查。
   */
  // static abstract tmsAccessWhite?(): string[]
  /**
   * 若请求来源于可信任主机，是否可以跳过认证
   */
  // static abstract tmsAuthTrustedHosts?(): boolean
  /**
   * 检查当前请求是否可以访问指定的租户空间
   */
  // static abstract tmsBucketValidator?(tmsClient: any): [boolean, any]
  /**
   * 执行每个控制器方法前执行的操作
   * 如果返回的是ResultFault类型，返回，不继续执行方法
   */
  abstract tmsBeforeEach?(method: string): any
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
  /**
   * 控制器方法
   */
  // [method: string]: (request: any) => any
}
