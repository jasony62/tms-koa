/**
 * 处理http请求的接口
 */
// http请求
const API_FIELD_REQUEST = Symbol("request")
// 发起调用的客户端
const API_FIELD_CLIENT = Symbol("client")
//
const API_FIELD_DBCONN = Symbol("dbconn")
const API_FIELD_WRITABLE_DBCONN = Symbol("writable_dbconn")

class Ctrl {
    constructor(request, client, db) {
        this[API_FIELD_REQUEST] = request
        this[API_FIELD_CLIENT] = client
        this[API_FIELD_DBCONN] = db
    }

    get request() {
        return this[API_FIELD_REQUEST]
    }

    get client() {
        return this[API_FIELD_CLIENT]
    }
    get dbConn() {
        return this[API_FIELD_DBCONN]
    }
    set writableDbConn(conn) {
        this[API_FIELD_WRITABLE_DBCONN] = conn
    }
    get writableDbConn() {
        return this[API_FIELD_WRITABLE_DBCONN]
    }
    /**
     * 加载指定的model包
     *
     * @param {*} name
     */
    model(name) {
        let { create: fnCreate } = require(`${process.cwd()}/models/${name}`)
        let model = fnCreate()
        model.context = this
        model.db({ conn: this.dbConn })
        return model
    }
    /**
     * 释放数据库连接
     */
    release() {
        let { Db } = require("../model/db")
        this.writableDbConn && Db.release(this.writableDbConn)
        this.dbConn && Db.release(this.dbConn)
    }
}

module.exports = { Ctrl }