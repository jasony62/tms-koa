const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-koa-ctrl')
const Router = require('koa-router')
const _ = require('lodash')
const jwt = require('jsonwebtoken')
const fs = require('fs')

const appConfig = require(process.cwd() + '/config/app')
const { DbContext, MongoContext, MongooseContext } = require('../app')
const { ResultFault, AccessTokenFault } = require('../response')
const { RequestTransaction } = require('../model/transaction')

/**
 * 根据请求路径找到匹配的控制器和方法
 *
 * 最后1段作为方法
 * 倒数第2端为文件名（加.js）
 * 如果文件不存在，倒数第2段作为目录名，查找main.js文件
 *
 * @param {Request} ctx
 * @param {Client} client 客户端
 * @param {DbContext} dbContext 数据库实例
 * @param {MongoClient} mongoClient mongodb实例
 *
 */
function findCtrlAndMethod(ctx, client, dbContext, mongoClient, mongoose) {
  let { path } = ctx.request

  if (prefix) path = path.replace(prefix, '')

  let pieces = path.split('/').filter(p => p)
  if (pieces.length === 0) {
    let logMsg = '参数错误，请求的控制器不存在(1)'
    logger.isDebugEnabled()
      ? logger.debug(logMsg, pieces)
      : logger.error(logMsg)
    throw new Error(logMsg)
  }

  let method = pieces.splice(-1, 1)[0]
  let ctrlName = pieces.length ? pieces.join('/') : 'main'

  let ctrlPath = process.cwd() + `/controllers/${ctrlName}.js`
  if (!fs.existsSync(ctrlPath)) {
    ctrlPath = process.cwd() + `/controllers/${ctrlName}/main.js`
    if (!fs.existsSync(ctrlPath)) {
      let logMsg = `参数错误，请求的控制器不存在(2)`
      logger.isDebugEnabled()
        ? logger.debug(logMsg, ctrlPath)
        : logger.error(logMsg)
      throw new Error(logMsg)
    }
  }

  const CtrlClass = require(ctrlPath)
  const oCtrl = new CtrlClass(ctx, client, dbContext, mongoClient, mongoose)
  if (oCtrl[method] === undefined && typeof oCtrl[method] !== 'function') {
    let logMsg = '参数错误，请求的控制器不存在(3)'
    logger.isDebugEnabled() ? logger.debug(logMsg, oCtrl) : logger.error(logMsg)
    throw new Error(logMsg)
  }

  return [oCtrl, method]
}
/**
 * 获得请求中传递的access_token
 *
 * @param {*} ctx
 */
function getAccessTokenByRequest(ctx) {
  let access_token
  let { request } = ctx
  let { authorization } = ctx.header
  if (authorization && authorization.indexOf('Bearer') === 0) {
    access_token = authorization.match(/\S+$/)[0]
  } else if (request.query.access_token) {
    access_token = request.query.access_token
  } else {
    return [false, '缺少Authorization头或access_token参数']
  }

  return [true, access_token]
}
/**
 * 根据请求找到对应的控制器并执行
 *
 * @param {Context} ctx
 *
 */
async function fnCtrlWrapper(ctx, next) {
  let { request, response } = ctx
  let tmsClient
  if (typeof appConfig.auth === 'object' && appConfig.auth.disabled !== true) {
    let [success, access_token] = getAccessTokenByRequest(ctx)
    if (false === success)
      return (response.body = new ResultFault(access_token))
    if (appConfig.auth.jwt) {
      try {
        let decoded = jwt.verify(access_token, appConfig.auth.jwt.privateKey)
        tmsClient = require('../auth/client').createByData(decoded)
      } catch (e) {
        if (e.name === 'TokenExpiredError') {
          response.body = new AccessTokenFault('认证令牌过期')
        } else {
          response.body = new ResultFault(e.message)
        }
        return
      }
    } else if (appConfig.auth.redis) {
      const Token = require('../auth/token')
      let aResult = await Token.fetch(access_token)
      if (false === aResult[0]) {
        response.body = new AccessTokenFault(aResult[1])
        return
      }
      tmsClient = aResult[1]
    }
  }
  // 数据库连接
  let dbContext, mongoClient, mongoose
  try {
    if (DbContext) {
      dbContext = new DbContext()
    }
    if (MongoContext) {
      mongoClient = await MongoContext.mongoClient()
    }
    if (MongooseContext) {
      mongoose = await MongooseContext.mongoose()
    }
    /**
     * 找到对应的控制器
     */
    let [oCtrl, method] = findCtrlAndMethod(
      ctx,
      tmsClient,
      dbContext,
      mongoClient,
      mongoose
    )
    /**
     * 是否需要事物？
     */
    if (dbContext) {
      let moTrans, trans
      if (appConfig.tmsTransaction === true) {
        if (
          oCtrl.tmsRequireTransaction &&
          typeof oCtrl.tmsRequireTransaction === 'function'
        ) {
          let transMethodes = oCtrl.tmsRequireTransaction()
          if (transMethodes && transMethodes[method]) {
            moTrans = new RequestTransaction(oCtrl, {
              db: dbContext.mysql,
              userid: tmsClient.id
            })
            trans = await moTrans.begin()
            //dbIns.transaction = trans
          }
        }
      }
    }
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
    /**
     * 结束事物
     */
    //if (moTrans && trans) await moTrans.end(trans.id)

    response.body = result

    next()
  } catch (err) {
    logger.error('控制器执行异常', err)
    let errMsg =
      typeof err === 'string' ? err : err.message ? err.message : err.toString()
    response.body = new ResultFault(errMsg)
  } finally {
    // 关闭数据库连接
    if (dbContext) {
      dbContext.end()
      dbContext = null
    }
  }
}

// 路由前缀必须以反斜杠开头
let prefix = _.get(appConfig, ['router', 'controllers', 'prefix'], '')
if (prefix && !/^\//.test(prefix)) prefix = `/${prefix}`

logger.info(`指定API控制器前缀：${prefix}`)

const router = new Router({ prefix })
router.all('/*', fnCtrlWrapper)

module.exports = router
