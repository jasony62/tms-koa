const Router = require("koa-router")
const fs = require("fs")
const { ResultFault, AccessTokenFault } = require("../response")
const Token = require("../auth/token")

/**
 * 根据请求路径找到匹配的控制器和方法
 *
 * 最后1段作为方法
 * 倒数第2端为文件名（加.js）
 * 如果文件不存在，倒数第2段作为目录名，查找main.js文件
 *
 * @param {Request} req
 * @param {Client} client
 */
function findCtrlAndMethod(req, client, dbConn) {
    let { path } = req
    let pieces = path.split("/")
    if (pieces.length < 2) throw new Error("参数错误，请求的对象不存在(1)")

    let method = pieces.splice(-1, 1)[0]
    let ctrlPath = process.cwd() + "/controllers/" + pieces.join("/") + ".js"
    if (!fs.existsSync(ctrlPath)) {
        ctrlPath = process.cwd() + "/controllers/" + pieces.join("/") + "/main.js"
        if (!fs.existsSync(ctrlPath))
            throw new Error("参数错误，请求的对象不存在(2)")
    }

    const CtrlClass = require(ctrlPath)
    const oCtrl = new CtrlClass(req, client, dbConn)
    if (oCtrl[method] === undefined && typeof oCtrl[method] !== "function")
        throw new Error("参数错误，请求的对象不存在(3)")

    return [oCtrl, method]
}

async function fnCtrlHandler(ctx) {
    let { request, response } = ctx

    const { access_token } = request.query
    if (!access_token) {
        response.body = new ResultFault('缺少access_token参数')
        return
    }

    let aResult = await Token.fetch(access_token)
    if (false === aResult[0]) {
        response.body = new AccessTokenFault(aResult[1])
        return
    }
    let tmsClient = aResult[1]

    /**
     * 获取数据库连接
     */
    let { Db } = require('../model/db')
    let dbConn = await Db.getConnection()

    let [oCtrl, method] = findCtrlAndMethod(request, tmsClient, dbConn)
    /**
     * 是否需要事物？
     */
    // let moTrans, trans
    // if (oCtrl.tmsRequireTransaction && typeof oCtrl.tmsRequireTransaction === 'function') {
    //     let transMethodes = oCtrl.tmsRequireTransaction()
    //     if (transMethodes && transMethodes[method]) {
    //         moTrans = new ReqTrans(req)
    //         trans = await moTrans.begin()
    //     }
    // }
    /**
     * 前置操作
     */
    if (oCtrl.tmsBeforeEach && typeof oCtrl.tmsBeforeEach === 'function') {
        const resultBefore = await oCtrl.tmsBeforeEach(method)
        if (resultBefore instanceof ResultFault) {
            response.body = resultBefore
            return
        }
    }
    const result = await oCtrl[method](request)

    response.body = result

    // 关闭数据库连接
    oCtrl.release()
}

const appConfig = require(process.cwd() + '/config/app')
const router = new Router({ prefix: appConfig.router.prefix })
router.all("/*", fnCtrlHandler)

module.exports = router