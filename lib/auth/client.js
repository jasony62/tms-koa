const FIELD_CLIENT_ID = Symbol("client_id")

const FIELD_CLIENT_DATA = Symbol("client_data")
/**
 * 访问用户
 */
class Client {
    /**
     * 构造用户数据
     *  
     * @param {string} id 用户标识
     * @param {object} data 用户数据
     */
    constructor(id, data) {
        this[FIELD_CLIENT_ID] = id
        this[FIELD_CLIENT_DATA] = data
    }
    get id() {
        return this[FIELD_CLIENT_ID]
    }
    get data() {
        return this[FIELD_CLIENT_DATA]
    }
    toPlainObject() {
        const { id, data } = this
        let obj = { id, data }
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
function createByData(oPlainData) {
    let { id, data } = oPlainData
    return new Client(id, data)
}

module.exports = {
    Client,
    createByData
}