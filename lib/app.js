const appConfig = require(process.cwd() + '/config/app')

const Koa = require("koa")

// 启动检查

class TmsKoa extends Koa {
    /**
     *
     * @param {*} options
     */
    constructor(options) {
        super(options)
    }
}

const app = new TmsKoa()

/**
 * 对外接口
 */
const { Client } = require('./auth/client')
const { Ctrl } = require('./controller/ctrl')
const { DbModel } = require('./model/model')
const {
    ResultData,
    ResultFault,
    ResultObjectNotFound
} = require('./response')

function startup() {
    let router = require("./auth/router")
    app.use(router.routes())

    router = require("./controller/router")
    app.use(router.routes()).use(router.allowedMethods())
    app.listen(appConfig.port)
}

module.exports = { startup, Client, Ctrl, DbModel, ResultData, ResultFault, ResultObjectNotFound }