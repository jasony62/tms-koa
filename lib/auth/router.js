const Router = require("koa-router")
const _ = require('underscore')

const { ResultData, ResultFault } = require('../response')
const Token = require('./token')

const appConfig = require(process.cwd() + '/config/app')
let prefix = _.property(['router', 'auth', 'prefix'])(appConfig)
const router = new Router({ prefix })

router.all("/auth/token", async ctx => {
    let { response } = ctx
    const fnCreateTmsClient = require(process.cwd() + "/auth/client.js")
    let tmsClient = fnCreateTmsClient(ctx)
    if (!tmsClient) {
        response.body = new ResultFault('没有获得有效用户信息', 40013)
        return
    }

    let aResult = await Token.create(tmsClient)
    if (false === aResult[0]) {
        response.body = new ResultFault(aResult[1], 10001)
        return
    }

    let token = aResult[1]
    response.body = new ResultData(token)
})

module.exports = router