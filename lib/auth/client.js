const crypto = require("crypto")
const { Model } = require("../model/model")

const FIELD_CLIENT_SITEID = Symbol("client_siteid")

const FIELD_CLIENT_ID = Symbol("client_id")

const FIELD_CLIENT_DATA = Symbol("client_data")

class TmsClient {
  constructor(siteid, id, data) {
    this[FIELD_CLIENT_SITEID] = siteid
    this[FIELD_CLIENT_ID] = id
    this[FIELD_CLIENT_DATA] = data
  }
  get siteid() {
    return this[FIELD_CLIENT_SITEID]
  }
  get id() {
    return this[FIELD_CLIENT_ID]
  }
  get data() {
    return this[FIELD_CLIENT_DATA]
  }
  toPlainObject() {
    const { siteid, id, data } = this
    let obj = { siteid, id, data }
    return obj
  }
  toString() {
    const { siteid, id, data } = this
    let obj = { siteid, id, data }
    return JSON.stringify(obj)
  }
}

class CookieClient extends Model {
  /**
   *
   */
  static getCookieKey(seed) {
    const md5 = crypto.createHash("md5")
    return md5.update(seed).digest("hex")
  }
  /**
   * 将当前用户的身份保留的在cookie中
   */
  static setCookieUser(siteId, user) {
    let cookiekey = this.getCookieKey(siteId)
    let oCookieUser = user
    oCookieUser = JSON.stringify(oCookieUser)
    let encoded = Model.encryptEnc(oCookieUser, cookiekey)

    return encoded
  }
  /**
   * 从cookie中获取当前用户信息
   */
  static getCookieUser(siteId, encoded) {
    if (!encoded) {
      return false
    }
    let cookiekey = this.getCookieKey(siteId)
    let oCookieUser = Model.encryptDec(encoded, cookiekey)
    oCookieUser = JSON.parse(oCookieUser)

    return oCookieUser
  }
}
/**
 * 创建TmsClient实例
 *
 * @param {Request} req
 */
function createTmsClient(req) {
  const { site } = req.query
  if (!site) return false

  let oCookieUser = CookieClient.getCookieUser(
    site,
    req.cookies[`xxt_site_${site}_fe_user`]
  )
  if (!oCookieUser || !oCookieUser.uid) return false

  let tmsClient = new TmsClient(site, oCookieUser.uid, oCookieUser)

  return tmsClient
}
/**
 * 从数据对象创建
 *
 * @param {*} oPlainData
 */
function createByData(oPlainData) {
  let { id, siteid, data } = oPlainData
  return new TmsClient(siteid, id, data)
}

module.exports = {
  create: createTmsClient,
  CookieClient,
  TmsClient,
  createByData
}
