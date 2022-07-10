"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequestTransaction = exports.Transaction = void 0;
const model_1 = require("./model");
const TRANS_USERID = Symbol('trans_userid');
class Transaction extends model_1.DbModel {
    constructor({ db = null, debug = false, userid = null } = {}) {
        super('tms_transaction', { db, debug });
        this[TRANS_USERID] = userid;
    }
    get userid() {
        return this[TRANS_USERID];
    }
    begin(proto) {
        return __awaiter(this, void 0, void 0, function* () {
            let trans = {};
            trans.begin_at = proto.begin_at || Date.now() / 1000;
            trans.request_uri = proto.request_uri || '';
            trans.user_agent = proto.user_agent || '';
            trans.referer = proto.referer || '';
            trans.remote_addr = proto.remote_addr || '';
            if (this.userid)
                trans.userid = this.userid;
            trans.id = yield this.insert(trans);
            return trans;
        });
    }
    end(transId) {
        return __awaiter(this, void 0, void 0, function* () {
            const endAt = Date.now() / 1000;
            let ret = this.updateById(transId, { end_at: endAt });
            return ret;
        });
    }
}
exports.Transaction = Transaction;
class RequestTransaction extends Transaction {
    constructor(ctrl, { db = null, debug = false, userid = null }) {
        super({ db, debug, userid });
        this.ctrl = ctrl;
    }
    begin() {
        const _super = Object.create(null, {
            begin: { get: () => super.begin }
        });
        return __awaiter(this, void 0, void 0, function* () {
            let req = this.ctrl.request;
            let reqTrans = {};
            reqTrans.request_uri = req.originalUrl;
            reqTrans.user_agent = req.headers['user-agent'] || '';
            reqTrans.referer = req.headers.referer || req.headers.referrer || '';
            reqTrans.remote_addr = req.id || '';
            return yield _super.begin.call(this, reqTrans);
        });
    }
}
exports.RequestTransaction = RequestTransaction;
