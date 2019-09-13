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

let router = require("./auth/router")
app.use(router.routes())

router = require("./controller/router")
app.use(router.routes()).use(router.allowedMethods())

function startup() {
    app.listen(appConfig.port)
}

module.exports = startup