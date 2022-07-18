import { Ctrl } from './ctrl'

const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-koa-ctrl')
const Router = require('@koa/router')
const _ = require('lodash')
const jwt = require('jsonwebtoken')
const fs = require('fs')
const nodePath = require('path')
const Debug = require('debug')

const debug = Debug('tms-koa:ctrl-router')

const { AppContext, DbContext, MongoContext, PushContext } =
  require('../app').Context

/**可信任主机配置文件存放位置*/
const TrustedHostsFile = nodePath.resolve(
  process.cwd(),
  process.env.TMS_KOA_CONFIG_DIR || 'config',
  'trusted-hosts.js'
)
const TrustedHosts = {}
if (fs.existsSync(TrustedHostsFile)) {
  logger.info(`从${TrustedHostsFile}加载信任主机列表`)
  Object.assign(TrustedHosts, require(TrustedHostsFile))
} else {
  logger.info(`未从${TrustedHostsFile}获得信任主机列表`)
}

const { ResultFault, AccessTokenFault } = require('../response')

// 从控制器路径查找
const CtrlDir =
  process.env.TMS_KOA_CONTROLLERS_DIR || process.cwd() + '/controllers'
debug(`控制器目录：${CtrlDir}`)

/**在控制器目录中查找控制器类 */
function findCtrlClassInCtrlDir(ctrlName, path: string) {
  let ctrlPath = nodePath.resolve(`${CtrlDir}/${ctrlName}.js`)
  if (!fs.existsSync(ctrlPath)) {
    ctrlPath = nodePath.resolve(`${CtrlDir}/${ctrlName}/main.js`)
    if (!fs.existsSync(ctrlPath)) {
      let logMsg = `参数错误，请求的控制器类不存在(2)`
      logger.isDebugEnabled()
        ? logger.debug(logMsg, ctrlName, path, ctrlPath)
        : logger.error(logMsg)
      throw new Error(logMsg)
    }
  }

  let CtrlClass = require(ctrlPath)

  return CtrlClass
}
/**控制器插件包*/
type NpmCtrl = { id: string; dir?: string; alias?: string }
/**从npm包中查找 */
function findCtrlClassInNpms(npmCtrl: NpmCtrl, ctrlName: any, path: string) {
  logger.debug(`控制器插件${JSON.stringify(npmCtrl)}匹配当前请求`)
  let CtrlClass, ctrlPath
  try {
    // 先检查是否存在包
    if (ctrlName.split('/')[0] === npmCtrl.alias) {
      // 用包名替换请求路径中的别名
      ctrlPath = ctrlName.replace(npmCtrl.alias, npmCtrl.id)
    } else {
      ctrlPath = ctrlName
    }
    if (npmCtrl.dir) {
      // 如果指定了起始目录，在其实报名后面添加起始目录
      ctrlPath = ctrlPath.replace(npmCtrl.id, `${npmCtrl.id}/${npmCtrl.dir}`)
    }
    CtrlClass = require(ctrlPath)
  } catch (e) {
    logger.warn(`查找npm控制器[${ctrlName}]失败[${e.message}]`, e)
    // 从控制器路径查找
    CtrlClass = findCtrlClassInCtrlDir(ctrlName, path)
  }
  return CtrlClass
}

/**
 *
 * @param {*} ctx
 */
function findCtrlClassAndMethodName(ctx) {
  let { path } = ctx.request

  if (prefix) path = path.replace(prefix, '')

  let pieces = path.split('/').filter((p) => p)
  if (pieces.length === 0) {
    let logMsg = '参数错误，请求的控制器不存在(1)'
    logger.isDebugEnabled()
      ? logger.debug(logMsg, path, pieces)
      : logger.error(logMsg)
    throw new Error(logMsg)
  }
  let CtrlClass
  const method: string = pieces.splice(-1, 1)[0]
  const ctrlName: string = pieces.length ? pieces.join('/') : 'main'

  /**指定的控制器插件包*/
  const npmCtrls: NpmCtrl[] = _.get(
    AppContext.insSync(),
    'router.controllers.plugins_npm'
  )
  let npmCtrl: NpmCtrl
  if (Array.isArray(npmCtrls) && npmCtrls.length) {
    npmCtrl = npmCtrls.find((nc) =>
      new RegExp(`${nc.alias}|${nc.id}`).test(ctrlName.split('/')[0])
    )
  }
  if (npmCtrl) {
    CtrlClass = findCtrlClassInNpms(npmCtrl, ctrlName, path)
  } else {
    CtrlClass = findCtrlClassInCtrlDir(ctrlName, path)
  }

  if (CtrlClass.default) CtrlClass = CtrlClass.default

  return [ctrlName, CtrlClass, method]
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

  /**只处理api请求（不能包含点），其它返回找不到*/
  if (/\./.test(request.path)) {
    response.status = 404
    return (response.body = 'Not Found')
  }

  /* 查找控制器和方法 */
  let findCtrlResult
  try {
    findCtrlResult = findCtrlClassAndMethodName(ctx)
  } catch (e) {
    let logMsg = e.message || `无法识别指定的请求，请检查输入的路径是否正确`
    logger.isDebugEnabled() ? logger.debug(logMsg, e) : logger.error(logMsg)
    return (response.body = new ResultFault(logMsg))
  }
  const [ctrlName, CtrlClass, method] = findCtrlResult

  /* 检查访问控制 */
  let tmsClient // 发送请求的用户
  const authConfig = AppContext.insSync().auth
  let accessWhite
  if (Object.prototype.hasOwnProperty.call(CtrlClass, 'tmsAccessWhite')) {
    accessWhite = CtrlClass.tmsAccessWhite()
    if (!Array.isArray(accessWhite)) {
      logger.warn(`控制器"${ctrlName}"白名单格式错误`, accessWhite)
      return (response.body = new ResultFault(
        '控制器认证白名单方法返回值格式错误'
      ))
    }
  }

  if (accessWhite?.includes(method)) {
    // 方法在白名单忠，跳过认证
  } else if (
    Object.prototype.hasOwnProperty.call(CtrlClass, 'tmsAuthTrustedHosts')
  ) {
    const skip = /yes|true/i.test(process.env.TMS_KOA_SKIP_TRUSTED_HOST ?? 'no')
    if (!skip) {
      // 检查是否来源于可信主机
      if (
        !TrustedHosts[ctrlName] ||
        !Array.isArray(TrustedHosts[ctrlName]) ||
        TrustedHosts[ctrlName].length === 0
      ) {
        let msg = `没有指定【${ctrlName}】可信任的请求来源主机`
        logger.debug(msg + '\n' + JSON.stringify(TrustedHosts, null, 2))
        return (response.body = new ResultFault(msg))
      }

      if (!request.ip)
        return (response.body = new ResultFault('无法获得请求来源主机的ip地址'))

      const ipv4 = request.ip.split(':').pop()

      const ctrlTrustedHosts = TrustedHosts[ctrlName]
      if (
        !ctrlTrustedHosts.some((rule) => {
          const re = new RegExp(rule)
          return re.test(request.ip) || re.test(ipv4)
        })
      ) {
        logger.warn(`未被信任的主机进行请求[${request.ip}]`)
        return (response.body = new ResultFault('请求来源主机不在信任列表中'))
      }
    } else {
      debug('控制器访问跳过可信任主机检查')
    }
  } else if (authConfig?.mode) {
    // 进行用户鉴权
    let [success, access_token] = getAccessTokenByRequest(ctx)
    if (false === success)
      return (response.body = new ResultFault(access_token))
    if (authConfig.jwt) {
      try {
        let decoded = jwt.verify(access_token, authConfig.jwt.privateKey)
        tmsClient = require('../auth/client').createByData(decoded)
      } catch (e) {
        if (e.name === 'TokenExpiredError') {
          response.body = new AccessTokenFault('认证令牌过期')
        } else {
          response.body = new ResultFault(e.message)
        }
        return
      }
    } else if (authConfig.redis) {
      const Token = require('../auth/token')
      let aResult = await Token.fetch(access_token)
      if (false === aResult[0]) {
        response.body = new AccessTokenFault(aResult[1])
        return
      }
      tmsClient = aResult[1]
      await Token.expire(access_token, tmsClient) // 重置token过期时间
    }
  }
  /* 数据库连接 */
  let dbContext, mongoClient, pushContext
  try {
    if (DbContext) {
      dbContext = new DbContext()
    }
    if (MongoContext) {
      mongoClient = await MongoContext.mongoClient()
    }
    if (PushContext) pushContext = await PushContext.ins()
    /**
     * 创建控制器实例
     */
    const oCtrl: Ctrl = new CtrlClass(
      ctx,
      tmsClient,
      dbContext,
      mongoClient,
      pushContext
    )
    /**
     * 检查指定的方法是否存在
     */
    if (oCtrl[method] === undefined && typeof oCtrl[method] !== 'function') {
      let logMsg = `参数错误，请求的控制器类方法[${method}]不存在(3)`
      logger.isDebugEnabled()
        ? logger.debug(logMsg, oCtrl)
        : logger.error(logMsg)
      return (response.body = new ResultFault(logMsg))
    }
    /**
     * 多租户模式，检查bucket
     */
    const appContext = AppContext.insSync()
    let bucketValidateResult
    if (Object.prototype.hasOwnProperty.call(CtrlClass, 'tmsBucketValidator')) {
      // 控制提供了bucket检查方法
      bucketValidateResult = await CtrlClass.tmsBucketValidator(tmsClient)
    } else if (appContext.checkClientBucket) {
      // 应用配置了bucket检查方法
      bucketValidateResult = await appContext.checkClientBucket(ctx, tmsClient)
    }
    if (bucketValidateResult) {
      const [passed, bucket] = bucketValidateResult
      if (passed !== true)
        return (response.body = new ResultFault('没有访问指定bucket资源的权限'))
      if (typeof bucket === 'string') oCtrl.bucket = bucket
    }
    /**
     * 前置操作
     */
    if (typeof oCtrl.tmsBeforeEach === 'function') {
      const resultBefore = await oCtrl.tmsBeforeEach(method)
      if (resultBefore instanceof ResultFault) {
        return (response.body = resultBefore)
      }
    }
    /* 执行方法调用 */
    const result = await oCtrl[method](request)

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

const prefix = AppContext.insSync().routerControllersPrefix

logger.info(`API控制器目录：${CtrlDir}，指定API控制器前缀：${prefix}`)

const router = new Router({ prefix })
router.all('/(.*)', fnCtrlWrapper)

export = router
