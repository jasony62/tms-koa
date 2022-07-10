import { DbModel } from './model'
/**
 * 事物
 */
const TRANS_USERID = Symbol('trans_userid')

export class Transaction extends DbModel {
  constructor({ db = null, debug = false, userid = null } = {}) {
    super('tms_transaction', { db, debug })
    this[TRANS_USERID] = userid
  }
  get userid() {
    return this[TRANS_USERID]
  }
  /**
   * 开始事物
   */
  async begin(proto) {
    let trans: any = {}
    trans.begin_at = proto.begin_at || Date.now() / 1000
    trans.request_uri = proto.request_uri || ''
    trans.user_agent = proto.user_agent || ''
    trans.referer = proto.referer || ''
    trans.remote_addr = proto.remote_addr || ''
    if (this.userid) trans.userid = this.userid
    trans.id = await this.insert(trans)

    return trans
  }
  /**
   * 结束事物
   */
  async end(transId) {
    const endAt = Date.now() / 1000
    let ret = this.updateById(transId, { end_at: endAt })

    return ret
  }
}
/**
 * express http request事物
 */
export class RequestTransaction extends Transaction {
  ctrl
  constructor(ctrl, { db = null, debug = false, userid = null }) {
    super({ db, debug, userid })
    this.ctrl = ctrl
  }
  async begin() {
    let req = this.ctrl.request
    let reqTrans: any = {}
    reqTrans.request_uri = req.originalUrl
    reqTrans.user_agent = req.headers['user-agent'] || ''
    reqTrans.referer = req.headers.referer || req.headers.referrer || ''
    reqTrans.remote_addr = req.id || ''

    return await super.begin(reqTrans)
  }
}
