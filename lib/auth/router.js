const Router = require("koa-router")
const _ = require('underscore')

const { ResultData, ResultFault } = require('../response')
const Token = require('./token')

const appConfig = require(process.cwd() + '/config/app')
let prefix = _.property(['router', 'auth', 'prefix'])(appConfig)
const router = new Router({ prefix })
/**
 * 换取token
 */
router.all("/auth/token", async ctx => {
    let { response } = ctx
    const fnCreateTmsClient = require(process.cwd() + "/auth/client.js")
    let tmsClient = await fnCreateTmsClient(ctx)
    if (!tmsClient) {
        response.body = new ResultFault('没有获得有效用户信息', 20012)
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
/**
 * 生成调用获取access_token的验证信息
 */
router.all("/auth/captcha", async ctx => {
    const fs = require('fs')
    if (!fs.existsSync(process.cwd() + "/auth/captcha.js"))
        return new ResultFault('未对调用鉴权接口设置验证信息', 20011)

    let { response } = ctx

    const fnCreateCaptcha = require(process.cwd() + "/auth/captcha.js")
    let captcha = await fnCreateCaptcha(ctx)
    if (!captcha) {
        response.body = new ResultFault('没有获得有效验证信息', 40001)
        return
    }

    response.body = new ResultData(captcha)
})

module.exports = router