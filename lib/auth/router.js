const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-koa-auth')
const Router = require('@koa/router')
const _ = require('lodash')
const jwt = require('jsonwebtoken')

const { ResultData, ResultFault, AccessTokenFault } = require('../response')

const { AppContext } = require('../app').Context

let { routerAuthPrefix, routerAuthTrustedHosts } = AppContext.insSync()
const router = new Router({ prefix: routerAuthPrefix })
logger.info(`指定Auth控制器前缀：${routerAuthPrefix}`)

const authConfig = AppContext.insSync().auth

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

  if (typeof createTmsClient === 'function')
    aResult = await createTmsClient(ctx)
  else aResult = [false, '没有指定用户认证方法']

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

  if (typeof registerTmsClient === 'function')
    aResult = await registerTmsClient(ctx)
  else aResult = [false, '没有指定用户注册方法']

  return aResult
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
 * 账号注册
 */
router.post('/register', async (ctx) => {
  if (!authConfig.jwt && !authConfig.redis)
    return (response.body = new ResultFault('没有指定用户认证方法'))

  let { response } = ctx
  let [passed, tmsClient] = await registerTmsClient(ctx)
  if (passed === false) {
    let msg = tmsClient ? tmsClient : '注册失败'
    return (response.body = new ResultFault(msg, 20013))
  }

  response.body = new ResultData(tmsClient)
})
/**
 * 换取client
 */
router.get('/client', async (ctx) => {
  let { response } = ctx

  if (!authConfig.jwt && !authConfig.redis)
    return (response.body = new ResultFault('没有指定用户认证方法'))

  const [success, access_token] = getAccessTokenByRequest(ctx)
  if (false === success) return (response.body = new ResultFault(access_token))

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
  response.body = new ResultData(tmsClient.toPlainObject())
})
/**
 * 换取access_token
 * @deprecated 用/auth/authenticate代替
 */
router.post(['/authenticate', '/authorize'], async (ctx) => {
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

  let [passed, tmsClient] = await getTmsClient(ctx)
  if (passed === false) {
    let msg = tmsClient ? tmsClient : '没有获得有效用户信息'
    return (response.body = new ResultFault(msg, 20012))
  }

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
      return (response.body = new ResultFault(aResult[1], 10001))
    }

    let token = aResult[1]
    response.body = new ResultData(token)
  }
})

/**
 * 生成验证码
 */
const createCaptcha = async (ctx) => {
  let { response } = ctx

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
}
router.get('/captcha', createCaptcha)
router.post('/captcha', createCaptcha)

/**
 * 校验验证码
 */
const checkCaptcha = async (ctx) => {
  let { response } = ctx

  let trusted = isTrustedHost(ctx)
  if (!trusted[0]) {
    logger.warn(`通过未授权主机调用auth::checkCaptcha接口，原因：${trusted[1]}`)
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
}
router.get('/checkCaptcha', checkCaptcha)
router.post('/checkCaptcha', checkCaptcha)

module.exports = router
