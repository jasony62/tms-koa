"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createByData = exports.Client = void 0;
const FIELD_CLIENT_ID = Symbol('client_id');
const FIELD_CLIENT_DATA = Symbol('client_data');
const FIELD_CLIENT_IS_ADMIN = Symbol('client_is_admin');
const FIELD_CLIENT_ALLOW_MULTI_LOGIN = Symbol('client_allow_multi_login');
class Client {
    constructor(id, data, isAdmin = false, allowMultiLogin = false) {
        this[FIELD_CLIENT_ID] = id;
        this[FIELD_CLIENT_DATA] = data;
        this[FIELD_CLIENT_IS_ADMIN] = isAdmin;
        this[FIELD_CLIENT_ALLOW_MULTI_LOGIN] = allowMultiLogin;
    }
    get id() {
        return this[FIELD_CLIENT_ID];
    }
    get data() {
        return this[FIELD_CLIENT_DATA];
    }
    get isAdmin() {
        return this[FIELD_CLIENT_IS_ADMIN];
    }
    get allowMultiLogin() {
        return this[FIELD_CLIENT_ALLOW_MULTI_LOGIN];
    }
    toPlainObject() {
        const { id, data, isAdmin, allowMultiLogin } = this;
        let obj = { id, data, isAdmin, allowMultiLogin };
        return obj;
    }
    toString() {
        return JSON.stringify(this.toPlainObject());
    }
}
exports.Client = Client;
function createByData(oPlainData) {
    let { id, data, isAdmin, allowMultiLogin } = oPlainData;
    return new Client(id, data, isAdmin === true, allowMultiLogin === true);
}
exports.createByData = createByData;
