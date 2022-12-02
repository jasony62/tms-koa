const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-koa-auth')
const Router = require('@koa/router')
const _ = require('lodash')
const jwt = require('jsonwebtoken')

const { ResultData, ResultFault, AccessTokenFault } = require('../response')
const { Context: TmsContext, getAccessTokenByRequest } = require('../app')
const { AppContext } = TmsContext
let { routerAuthPrefix, routerAuthTrustedHosts } = AppContext.insSync()
const router = new Router({ prefix: routerAuthPrefix })
logger.info(`指定Auth控制器前缀：${routerAuthPrefix}`)

const authConfig = AppContext.insSync().auth
// 获取error msg
function getErrMsg(error, msg = '未知错误') {
  if (typeof error === 'string') return error
  else if (error instanceof Error) {
    return error.message ? error.message : error.toString()
  }

  return msg
}
/**
 * 检查当前的请求是否来源于可信任主机
 * @param {*} ctx
 * @returns
 */
const isTrustedHost = (() => {
  if (routerAuthTrustedHosts.length === 0) {
    return () => [true]
  } else {
    return (ctx) => {
      const { request } = ctx

      if (!request.ip) return [false, '无法获得请求来源主机的ip地址']

      const ipv4 = request.ip.split(':').pop()

      const found = routerAuthTrustedHosts.find((rule) => {
        let re = new RegExp(rule)
        return re.test(request.ip) || re.test(ipv4)
      })

      return found ? [true] : [false, `不允许[${request.ip}]进行访问`]
    }
  }
})()
/**
 * 获得用户认证信息
 */
async function getTmsClient(ctx) {
  let aResult

  let clientConfig = _.get(authConfig, ['client'], {})
  const { createTmsClient } = clientConfig

  if (typeof createTmsClient === 'function') {
    /**用户认证时需要验证验证码*/
    let fnCheckCaptcha
    let captchaConfig = _.get(authConfig, ['captcha'], {})
    if (typeof captchaConfig.checkCaptcha === 'function') {
      fnCheckCaptcha = captchaConfig.checkCaptcha
    }
    aResult = await createTmsClient(ctx, TmsContext, fnCheckCaptcha)
  } else aResult = [false, '没有指定用户认证方法']

  return aResult
}
/**
 * 注册账号
 * @param {*} ctx
 * @returns
 */
async function registerTmsClient(ctx) {
  let aResult

  let clientConfig = _.get(authConfig, ['client'], {})
  const { registerTmsClient } = clientConfig

  if (typeof registerTmsClient === 'function') {
    /**用户认证时需要验证验证码*/
    let fnCheckCaptcha
    let captchaConfig = _.get(authConfig, ['captcha'], {})
    if (typeof captchaConfig.checkCaptcha === 'function') {
      fnCheckCaptcha = captchaConfig.checkCaptcha
    }
    aResult = await registerTmsClient(ctx, TmsContext, fnCheckCaptcha)
  } else aResult = [false, '没有指定用户注册方法']

  return aResult
}
/**
 * 账号注册
 */
router.post('/register', async (ctx) => {
  let { response } = ctx

  try {
    if (!authConfig.jwt && !authConfig.redis)
      return (response.body = new ResultFault('没有指定用户注册方法'))

    let [passed, userInfo] = await registerTmsClient(ctx)
    if (passed === false) {
      let msg = userInfo ? userInfo : '注册失败'
      return (response.body = new ResultFault(msg, 20013))
    }

    return (response.body = new ResultData(userInfo))
  } catch (error) {
    logger.error(error)
    response.body = new ResultFault(
      error.message ? error.message : error.toString(),
      20050
    )
  }
})
/**
 * 换取client
 */
router.get('/client', async (ctx) => {
  let { response } = ctx

  try {
    if (!authConfig.jwt && !authConfig.redis)
      return (response.body = new ResultFault('没有指定用户认证方法'))

    const [success, access_token] = getAccessTokenByRequest(ctx)
    if (false === success)
      return (response.body = new ResultFault(access_token))

    let tmsClient
    if (authConfig.jwt) {
      let decoded = jwt.decode(access_token)
      tmsClient = require('./client').createByData(decoded)
    } else if (authConfig.redis) {
      const Token = require('./token')
      let aResult = await Token.fetch(access_token)
      if (false === aResult[0]) {
        return (response.body = new AccessTokenFault(aResult[1]))
      }
      tmsClient = aResult[1]
    }
    return (response.body = new ResultData(tmsClient.toPlainObject()))
  } catch (error) {
    logger.error(error)
    response.body = new ResultFault(
      error.message ? error.message : error.toString(),
      20050
    )
  }
})
/**
 * 换取access_token
 * 用/authenticate代替
 */
const authenticate = async (ctx) => {
  let { response } = ctx

  try {
    if (!authConfig.jwt && !authConfig.redis)
      return (response.body = new ResultFault('没有指定用户认证方法'))

    let trusted = isTrustedHost(ctx)
    if (!trusted[0]) {
      logger.warn(
        `有通过未授权主机调用auth::authenticate接口，原因：${trusted[1]}`
      )
      return (response.body = new ResultFault('不允许调用此接口'))
    }

    /**根据请求中携带的信息，获得访问用户数据*/
    let [passed, tmsClient] = await getTmsClient(ctx)
    if (passed === false) {
      let msg = tmsClient ? tmsClient : '没有获得有效用户信息'
      return (response.body = new ResultFault(msg, 20012))
    }
    /**添加万能码 */
    let { magic } = ctx.request.body
    if (magic && typeof magic === 'string') tmsClient.magic = magic

    /**生成token */
    if (authConfig.jwt) {
      let { privateKey, expiresIn } = authConfig.jwt
      let token = jwt.sign(tmsClient.toPlainObject(), privateKey, { expiresIn })
      response.body = new ResultData({
        access_token: token,
        expire_in: expiresIn,
      })
    } else if (authConfig.redis) {
      const Token = require('./token')
      let aResult = await Token.create(tmsClient)
      if (false === aResult[0]) {
        return (response.body = new ResultFault(aResult[1], 20001))
      }

      let token = aResult[1]
      response.body = new ResultData(token)
    }
  } catch (error) {
    logger.error(error)
    response.body = new ResultFault(
      error.message ? error.message : error.toString(),
      20050
    )
  }
}
router.post(['/authenticate', '/authorize'], authenticate)
router.get(['/authenticate', '/authorize'], authenticate)
/**
 * 退出登录
 */
const logout = async (ctx) => {
  let { response } = ctx
  if (!authConfig.jwt && !authConfig.redis)
    return (response.body = new ResultFault('没有指定用户认证方法'))

  let trusted = isTrustedHost(ctx)
  if (!trusted[0]) {
    logger.warn(
      `有通过未授权主机调用auth::authenticate接口，原因：${trusted[1]}`
    )
    return (response.body = new ResultFault('不允许调用此接口'))
  }

  const [success, access_token] = getAccessTokenByRequest(ctx)
  if (false === success) return (response.body = new ResultFault(access_token))

  try {
    if (authConfig.jwt) {
      // let decoded = jwt.decode(access_token)
    } else if (authConfig.redis) {
      const Token = require('./token')
      let aResult = await Token.logout(access_token)
      if (false === aResult[0]) {
        return (response.body = new AccessTokenFault(getErrMsg(aResult[1])))
      }
    }
  } catch (error) {
    logger.error(error)
    return (response.body = new ResultFault(getErrMsg(error), 20050))
  }

  response.body = new ResultData('成功')
}
router.get(['/logout'], logout)
/**
 * 生成验证码
 */
const createCaptcha = async (ctx) => {
  let { response } = ctx

  try {
    let trusted = isTrustedHost(ctx)
    if (!trusted[0]) {
      logger.warn(`通过未授权主机调用auth::captcha接口，原因：${trusted[1]}`)
      return (response.body = new ResultFault('不允许调用此接口'))
    }

    let captchaConfig = _.get(authConfig, ['captcha'], {})
    if (typeof captchaConfig.createCaptcha === 'function') {
      let captcha = await captchaConfig.createCaptcha(ctx)
      if (captcha[0] === false) {
        let msg = captcha[1] ? captcha[1] : '没有获得有效的验证码'
        return (response.body = new ResultFault(msg, 40001))
      }

      captcha = captcha[1]
      return (response.body = new ResultData(captcha))
    }

    response.body = new ResultFault(
      '未设置用验证码限制调用用户认证接口的方法',
      20011
    )
  } catch (error) {
    logger.error(error)
    response.body = new ResultFault(
      error.message ? error.message : error.toString(),
      20050
    )
  }
}
router.get('/captcha', createCaptcha)
router.post('/captcha', createCaptcha)

/**
 * 校验验证码
 */
const checkCaptcha = async (ctx) => {
  let { response } = ctx

  try {
    let trusted = isTrustedHost(ctx)
    if (!trusted[0]) {
      logger.warn(
        `通过未授权主机调用auth::checkCaptcha接口，原因：${trusted[1]}`
      )
      return (response.body = new ResultFault('不允许调用此接口'))
    }

    let captchaConfig = _.get(authConfig, ['captcha'], {})
    if (typeof captchaConfig.checkCaptcha === 'function') {
      let rst = await captchaConfig.checkCaptcha(ctx)
      if (rst[0] === false) {
        let msg = rst[1] ? rst[1] : '验证码错误'
        return (response.body = new ResultFault(msg, 40002))
      }
      rst = rst[1]
      return (response.body = new ResultData(rst))
    }

    response.body = new ResultFault('未设置检查验证码的方法', 20012)
  } catch (error) {
    logger.error(error)
    response.body = new ResultFault(
      error.message ? error.message : error.toString(),
      20050
    )
  }
}
router.get('/checkCaptcha', checkCaptcha)
router.post('/checkCaptcha', checkCaptcha)

export = router
