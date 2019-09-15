const fs = require('fs')
const Koa = require('koa')

class TmsKoa extends Koa {
    /**
     *
     * @param {*} options
     */
    constructor(options) {
        super(options)
    }
    /**
     * 
     */
    startup() {
        // 启动检查
        const appConfig = require(process.cwd() + '/config/app')
        /**
         * 启动数据库连接池
         */
        const { DbContext } = require('./model/db')
        DbContext.getPool()
        /**
         * 支持访问静态文件
         */
        let staticPath = process.cwd() + '/public'
        if (fs.existsSync(staticPath)) {
            this.use(require('koa-static')(staticPath))
        }
        /**
         * 获得access_token
         */
        let router = require("./auth/router")
        this.use(router.routes())
        /**
         * 控制器
         */
        router = require("./controller/router")
        this.use(router.routes())

        this.listen(appConfig.port)
    }
}
/**
 * 对外接口
 */
const { Client } = require('./auth/client')
const { Ctrl } = require('./controller/ctrl')
const { Db, DbModel } = require('./model')
const { ResultData, ResultFault, ResultObjectNotFound } = require('./response')

module.exports = { TmsKoa, Client, Ctrl, Db, DbModel, ResultData, ResultFault, ResultObjectNotFound }