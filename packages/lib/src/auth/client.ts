const FIELD_CLIENT_ID = Symbol('client_id')
const FIELD_CLIENT_DATA = Symbol('client_data')
const FIELD_CLIENT_IS_ADMIN = Symbol('client_is_admin')
const FIELD_CLIENT_ALLOW_MULTI_LOGIN = Symbol('client_allow_multi_login')
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
  constructor(id, data, isAdmin = false, allowMultiLogin = false) {
    this[FIELD_CLIENT_ID] = id
    this[FIELD_CLIENT_DATA] = data
    this[FIELD_CLIENT_IS_ADMIN] = isAdmin
    this[FIELD_CLIENT_ALLOW_MULTI_LOGIN] = allowMultiLogin
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
  /**采用get方法，转json串时取不到 */
  toPlainObject() {
    const { id, data, isAdmin, allowMultiLogin } = this
    let obj = { id, data, isAdmin, allowMultiLogin }
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
  let { id, data, isAdmin, allowMultiLogin } = oPlainData
  return new Client(id, data, isAdmin === true, allowMultiLogin === true)
}
