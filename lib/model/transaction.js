const { DbModel } = require('./model')
/**
 * 事物
 */
class Transaction extends DbModel {
    constructor({ db = null, debug = false } = {}) {
        super('tms_transaction', { db, debug })
    }
    /**
     * 开始事物
     */
    async begin(proto) {
        let trans = {}
        trans.begin_at = proto.begin_at || (Date.now() / 1000)
        trans.request_uri = proto.request_uri || ''
        trans.user_agent = proto.user_agent || ''
        trans.referer = proto.referer || ''
        trans.remote_addr = proto.remote_addr || ''
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
class RequestTransaction extends Transaction {
    constructor(ctrl, { db = null, debug = false }) {
        super({ db, debug })
        this.ctrl = ctrl
    }
    async begin() {
        let req = this.ctrl.request
        let reqTrans = {}
        reqTrans.request_uri = req.originalUrl
        reqTrans.user_agent = req.headers['user-agent'] || ''
        reqTrans.referer = req.headers.referer || req.headers.referrer || ''
        reqTrans.remote_addr = req.id || ''

        return await super.begin(reqTrans)
    }
}

module.exports = { Transaction, RequestTransaction }