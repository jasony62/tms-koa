const FIELD_CLIENT_ID = Symbol('client_id')
const FIELD_CLIENT_DATA = Symbol('client_data')
const FIELD_CLIENT_IS_ADMIN = Symbol('client_is_admin')
const FIELD_CLIENT_ALLOW_MULTI_LOGIN = Symbol('client_allow_multi_login')
const FIELD_CLIENT_MAGIC = Symbol('client_magic')
const FIELD_CLIENT_EXPIRES_IN = Symbol('client_expires_in')
/**
 * 访问用户
 */
export class Client {
  /**
   * 构造用户数据
   *
   * @param {string} id - 用户标识
   * @param {object} data - 用户数据
   * @param {boolean} [isAdmin=false] - 是否为管理员
   * @param {boolean} [allowMultiLogin=false] - 是否允许多点登录
   */
  constructor(
    id,
    data,
    isAdmin = false,
    allowMultiLogin = false,
    expiresIn = 0
  ) {
    this[FIELD_CLIENT_ID] = id
    this[FIELD_CLIENT_DATA] = data
    this[FIELD_CLIENT_IS_ADMIN] = isAdmin
    this[FIELD_CLIENT_ALLOW_MULTI_LOGIN] = allowMultiLogin
    this[FIELD_CLIENT_EXPIRES_IN] = expiresIn
  }
  get id() {
    return this[FIELD_CLIENT_ID]
  }
  get data() {
    return this[FIELD_CLIENT_DATA]
  }
  /**是管理员 */
  get isAdmin() {
    return this[FIELD_CLIENT_IS_ADMIN]
  }
  /**允许多点登录 */
  get allowMultiLogin() {
    return this[FIELD_CLIENT_ALLOW_MULTI_LOGIN]
  }
  /**万能码 */
  set magic(val) {
    this[FIELD_CLIENT_MAGIC] = val
  }
  get magic() {
    return this[FIELD_CLIENT_MAGIC]
  }
  /**认证有效期 */
  get expiresIn() {
    return this[FIELD_CLIENT_EXPIRES_IN]
  }
  /**采用get方法，转json串时取不到 */
  toPlainObject() {
    const { id, data, isAdmin, allowMultiLogin, magic, expiresIn } = this
    let obj = { id, data, isAdmin, allowMultiLogin, magic, expiresIn }
    return obj
  }
  toString() {
    return JSON.stringify(this.toPlainObject())
  }
}
/**
 * 从数据对象创建
 *
 * @param {object} oPlainData
 */
export function createByData(oPlainData) {
  let { id, data, isAdmin, allowMultiLogin, magic, expiresIn } = oPlainData
  let client = new Client(
    id,
    data,
    isAdmin === true,
    allowMultiLogin === true,
    parseInt(expiresIn)
  )
  client.magic = magic

  return client
}
