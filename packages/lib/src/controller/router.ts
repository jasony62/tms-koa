import { Ctrl } from './ctrl.js'

import log4js from '@log4js-node/log4js-api'
import Router from '@koa/router'
import _ from 'lodash'
import jwt from 'jsonwebtoken'
import fs from 'fs'
import nodePath from 'path'
import Debug from 'debug'

import { Context as TmsContext, getAccessTokenByRequest } from '../app.js'
import { ResultSSE } from '../response.js'

const logger = log4js.getLogger('tms-koa-ctrl')
const debug = Debug('tms-koa:ctrl-router')

const { AppContext, DbContext, MongoContext, FsContext, PushContext } =
  TmsContext

/**可信任主机配置文件存放位置*/
const TrustedHostsFile = nodePath.resolve(
  process.cwd(),
  process.env.TMS_KOA_CONFIG_DIR || 'config',
  'trusted-hosts.js'
)
const TrustedHosts = {}
if (fs.existsSync(TrustedHostsFile)) {
  logger.info(`从${TrustedHostsFile}加载信任主机列表`)
  Object.assign(TrustedHosts, (await import(TrustedHostsFile)).default)
} else {
  logger.info(`未从${TrustedHostsFile}获得信任主机列表`)
}

const { ResultFault, AccessTokenFault } = await import('../response.js')

// 从控制器路径查找
const CtrlDir = nodePath.resolve(
  process.env.TMS_KOA_CONTROLLERS_DIR || process.cwd() + '/dist/controllers'
)
debug(`控制器目录：${CtrlDir}`)

// 记录指标
const { Metrics } = await import('./metrics.js')
const metrics = new Metrics()
/**
 * 记录处理的数据
 */
class ChainState {
  ctrlName?: string
  CtrlClass?: any
  method?: string
  tmsClient?: any
  oCtrl?: any
  inAccessWhite = false
  checkTrustedHosted = false
  ctrlTime = 0
}

type ChainNext = (state?: ChainState) => void

interface StageHandler {
  name: string
  handle(ctx, next: ChainNext, state?: ChainState)
}

abstract class BaseHandler implements StageHandler {
  name: string
  abstract handle(ctx: any, next: ChainNext, state?: ChainState)
}
/**
 * 检查请求路径是否有效
 */
class CheckPathHandler extends BaseHandler {
  name = 'CheckPath'
  /**
   *
   * @param ctx
   * @param next
   * @returns
   */
  async handle(ctx: any, next: ChainNext) {
    let { request, response } = ctx
    /**只处理api请求（不能包含点），其它返回找不到*/
    if (/\./.test(request.path)) {
      response.status = 404
      response.body = 'Not Found'
      return
    }
    await next()
  }
}
/**控制器插件包*/
type NpmCtrl = {
  id: string
  dir?: string
  alias?: string
  node_modules_root?: string
}
/**
 * 查找匹配的控制器
 */
class FindCtrlClassAndMethodNameHandler extends BaseHandler {
  name = 'FindCtrl'
  /**在控制器目录中查找控制器类 */
  async findCtrlClassInCtrlDir(ctrlName, path: string) {
    let ctrlPath = `${CtrlDir}/${ctrlName}.js`
    if (!fs.existsSync(ctrlPath)) {
      ctrlPath = `${CtrlDir}/${ctrlName}/main.js`
      if (!fs.existsSync(ctrlPath)) {
        let logMsg = `参数错误，请求的控制器类不存在(2)`
        debug(
          logMsg + '\n' + JSON.stringify({ ctrlName, path, ctrlPath }, null, 2)
        )
        logger.isDebugEnabled()
          ? logger.debug(logMsg, ctrlName, path, ctrlPath)
          : logger.error(logMsg)
        throw new Error(logMsg)
      }
    }

    let CtrlClass = (await import(`${ctrlPath}`)).default

    return CtrlClass
  }
  /**从npm包中查找 */
  async findCtrlClassInNpms(npmCtrl: NpmCtrl, ctrlName: any, path: string) {
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
        // 如果指定了起始目录，在起始包名后面添加起始目录
        ctrlPath = ctrlPath.replace(npmCtrl.id, `${npmCtrl.id}/${npmCtrl.dir}`)
      }
      logger.debug(`导入npm控制器[${ctrlName}]的包路径[${ctrlPath}]`)
      if (npmCtrl.node_modules_root) {
        /**
         * 指定包加载的路径，按照文件加载
         */
        const prefix = `${npmCtrl.node_modules_root}/node_modules`
        if (fs.existsSync(`${prefix}/${ctrlPath}.js`))
          CtrlClass = await import(`${prefix}/${ctrlPath}.js`)
        else if (fs.existsSync(`${prefix}/${ctrlPath}/index.js`))
          CtrlClass = await import(`${prefix}/${ctrlPath}/index.js`)
        else throw new Error(`根据[${ctrlPath}]查找npm控制器[${ctrlName}]失败`)
      } else {
        /**
         * 按照标准的包加载
         */
        if (fs.existsSync(`node_modules/${ctrlPath}.js`))
          CtrlClass = await import(`${ctrlPath}.js`)
        else if (fs.existsSync(`node_modules/${ctrlPath}/index.js`))
          CtrlClass = await import(`${ctrlPath}/index.js`)
        else throw new Error(`根据[${ctrlPath}]查找npm控制器[${ctrlName}]失败`)
      }
    } catch (e) {
      logger.warn(`查找npm控制器[${ctrlName}]失败[${e.message}]`, e)
      // 从控制器路径查找
      CtrlClass = await this.findCtrlClassInCtrlDir(ctrlName, path)
    }
    return CtrlClass
  }
  /**
   *
   * @param {*} request
   */
  async findCtrlClassAndMethodName(request) {
    let { path } = request

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
      CtrlClass = await this.findCtrlClassInNpms(npmCtrl, ctrlName, path)
    } else {
      CtrlClass = await this.findCtrlClassInCtrlDir(ctrlName, path)
    }

    if (CtrlClass.default) CtrlClass = CtrlClass.default

    return [ctrlName, CtrlClass, method]
  }
  /**
   *
   * @param ctx
   * @param next
   */
  async handle(ctx: any, next: ChainNext) {
    let { request, response } = ctx
    /* 查找控制器和方法 */
    let findCtrlResult
    try {
      findCtrlResult = await this.findCtrlClassAndMethodName(request)
      const [ctrlName, CtrlClass, method] = findCtrlResult
      let ctrlTarget = new ChainState()
      ctrlTarget.ctrlName = ctrlName
      ctrlTarget.CtrlClass = CtrlClass
      ctrlTarget.method = method

      await next(ctrlTarget)
    } catch (e) {
      let logMsg = e.message || `无法识别指定的请求，请检查输入的路径是否正确`
      logger.isDebugEnabled() ? logger.debug(logMsg, e) : logger.error(logMsg)
      response.body = new ResultFault(logMsg)
    }
  }
}
/**
 * 检查控制自带白名单
 */
class CheckTmsAccessWhiteHandler extends BaseHandler {
  name = 'TmsAccessWhite'
  /**
   *
   * @param ctx
   * @param next
   * @param state
   * @returns
   */
  async handle(ctx: any, next: ChainNext, state: ChainState) {
    let { response } = ctx
    const { ctrlName, CtrlClass, method } = state
    let accessWhite
    if (Object.prototype.hasOwnProperty.call(CtrlClass, 'tmsAccessWhite')) {
      accessWhite = CtrlClass.tmsAccessWhite()
      if (!Array.isArray(accessWhite)) {
        logger.warn(`控制器"${ctrlName}"白名单格式错误`, accessWhite)
        response.body = new ResultFault('控制器认证白名单方法返回值格式错误')
        return
      }
      if (accessWhite?.includes(method)) {
        // 方法在白名单忠，跳过认证
        state.inAccessWhite = true
      }
    }
    await next(state)
  }
}
/**
 * 检查请求是否来源于信任主机
 */
class CheckTmsAuthTrustedHosts extends BaseHandler {
  name = 'TmsAuthTrustedHosts'
  /**
   *
   * @param ctx
   * @param next
   * @param state
   * @returns
   */
  async handle(ctx: any, next: ChainNext, state: ChainState) {
    if (state.inAccessWhite === true) {
      await next(state)
      return
    }

    const { ctrlName, CtrlClass } = state
    if (
      !Object.prototype.hasOwnProperty.call(CtrlClass, 'tmsAuthTrustedHosts')
    ) {
      await next(state)
      return
    }
    debug(`控制器【${ctrlName}】允许信任主机方案`)

    const { request, response } = ctx
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

      debug(`控制器【${ctrlName}】收到来自【${request.ip}】的请求`)

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

    state.checkTrustedHosted = true
    await next(state)
  }
}
/**
 * 用户认证
 */
class CheckAuthHandler extends BaseHandler {
  name = 'CheckAuth'
  /**
   *
   * @param ctx
   * @param next
   * @param state
   * @returns
   */
  async handle(ctx: any, next: ChainNext, state: ChainState) {
    if (state.inAccessWhite === true || state.checkTrustedHosted === true) {
      await next(state)
      return
    }

    const authConfig = AppContext.insSync().auth
    if (!authConfig?.mode) {
      await next(state)
      return
    }

    let tmsClient
    let { response } = ctx
    // 进行用户鉴权
    let [success, access_token] = getAccessTokenByRequest(ctx)
    if (false === success)
      return (response.body = new ResultFault(access_token))
    if (authConfig.jwt) {
      try {
        let decoded = jwt.verify(access_token, authConfig.jwt.privateKey)
        tmsClient = (await import('../auth/client.js')).createByData(decoded)
      } catch (e) {
        if (e.name === 'TokenExpiredError') {
          response.body = new AccessTokenFault('JWT认证令牌过期')
        } else {
          let msg = `JWT令牌验证失败：${e.message}`
          debug(msg + ` (${authConfig.jwt.privateKey})`)
          response.body = new ResultFault(msg)
        }
        return
      }
    } else if (authConfig.redis) {
      const { Token } = await import('../auth/token.js')
      let aResult = await Token.fetch(access_token)
      if (false === aResult[0]) {
        response.body = new AccessTokenFault(aResult[1])
        return
      }
      tmsClient = aResult[1]
      await Token.expire(access_token, tmsClient) // 重置token过期时间
    }
    state.tmsClient = tmsClient
    await next(state)
  }
}
/**
 * 创建控制器
 */
class CreateCtrlHandler extends BaseHandler {
  name = 'CreateCtrl'
  /**
   *
   * @param ctx
   * @param next
   * @param state
   */
  async handle(ctx: any, next: ChainNext, state: ChainState) {
    const { CtrlClass, tmsClient } = state
    /* 数据库连接 */
    let dbContext, mongoClient, fsContext, pushContext

    if (DbContext) {
      dbContext = new DbContext()
    }
    if (MongoContext) {
      mongoClient = await MongoContext.mongoClient()
    }
    if (FsContext) fsContext = await FsContext.ins()
    if (PushContext) pushContext = await PushContext.ins()
    /**
     * 创建控制器实例
     */
    const oCtrl: Ctrl = new CtrlClass(
      ctx,
      tmsClient,
      dbContext,
      mongoClient,
      pushContext,
      fsContext
    )
    oCtrl.tmsContext = TmsContext
    state.oCtrl = oCtrl
    await next(state)
  }
}
/**
 * 检查指定的方法是否存在
 */
class CheckCtrlMethod extends BaseHandler {
  name = 'CheckMethod'
  /**
   *
   * @param ctx
   * @param next
   * @param state
   * @returns
   */
  async handle(ctx: any, next: ChainNext, state: ChainState) {
    const { response } = ctx
    const { oCtrl, method } = state
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
    await next(state)
  }
}
/**
 * 多租户模式，检查bucket
 * 白名单方法不检查bucket
 */
class CheckBuckHandler extends BaseHandler {
  name = 'CheckBucket'
  /**
   *
   * @param ctx
   * @param next
   * @param state
   * @returns
   */
  async handle(ctx: any, next: ChainNext, state: ChainState) {
    const { response } = ctx
    const { CtrlClass, tmsClient, oCtrl } = state
    /**
     * 多租户模式，检查bucket
     * 白名单方法不检查bucket
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
    await next(state)
  }
}
/**
 * 控制器前置操作
 */
class TmsBeforeEachHandler extends BaseHandler {
  name = 'TmsBeforeEach'
  /**
   *
   * @param ctx
   * @param next
   * @param state
   * @returns
   */
  async handle(ctx: any, next: ChainNext, state: ChainState) {
    const { response } = ctx
    const { oCtrl, method } = state
    /**
     * 前置操作
     */
    if (typeof oCtrl.tmsBeforeEach === 'function') {
      const resultBefore = await oCtrl.tmsBeforeEach(method)
      if (resultBefore instanceof ResultFault) {
        return (response.body = resultBefore)
      }
    }
    await next(state)
  }
}
/**
 * 执行控制器方法
 */
class ExecCtrlMethodHandler extends BaseHandler {
  name = 'ExecCtrl'
  /**
   *
   * @param ctx
   * @param next
   * @param state
   */
  async handle(ctx: any, next: ChainNext, state: ChainState) {
    const { response, request } = ctx
    const { oCtrl, method } = state
    const start = Date.now()

    /* 执行方法调用 */
    const result = await oCtrl[method](request)
    // 如果是SSE方式返回结果，由控制器自己写response
    if (!(result instanceof ResultSSE)) {
      response.body = result
    }

    // 记录耗时
    state.ctrlTime = Date.now() - start

    await next(state)
  }
}
/**
 * 处理收到的请求
 */
const chain = []
chain.push(new CheckPathHandler())
chain.push(new FindCtrlClassAndMethodNameHandler())
chain.push(new CheckTmsAccessWhiteHandler())
chain.push(new CheckTmsAuthTrustedHosts())
chain.push(new CheckAuthHandler())
chain.push(new CreateCtrlHandler())
chain.push(new CheckCtrlMethod())
chain.push(new CheckBuckHandler())
chain.push(new TmsBeforeEachHandler())
chain.push(new ExecCtrlMethodHandler())
/**
 * 根据请求找到对应的控制器并执行
 *
 * @param {Context} ctx
 *
 */
async function fnCtrlWrapper(ctx, next) {
  let { response } = ctx
  /**
   * 检查指定的方法是否存在
   */
  try {
    let index = -1
    let latestState
    const runChain = async (state?) => {
      if (state) latestState = state
      if (index + 1 < chain.length) {
        let h = chain[++index]
        await h.handle(ctx, runChain, state)
      }
    }
    await runChain()

    // 记录指标
    if (index < chain.length) {
      let { url } = ctx.request
      let h = chain[index]
      let stage = h.name
      let ctrlName = latestState?.ctrlName
      let ctrlMethod = latestState?.method
      let ctrlTime = latestState?.ctrlTime
      let labels = { url, stage, ctrlName, ctrlMethod }
      metrics.total(labels)
      if (ctrlTime) metrics.time(labels, ctrlTime)
    }

    next()
  } catch (err) {
    logger.error('控制器执行异常', err)
    let errMsg =
      typeof err === 'string' ? err : err.message ? err.message : err.toString()
    response.body = new ResultFault(errMsg)
  } finally {
    // 关闭数据库连接
    // if (dbContext) {
    //   dbContext.end()
    //   dbContext = null
    // }
  }
}

const prefix = AppContext.insSync().routerControllersPrefix

logger.info(`API控制器目录：${CtrlDir}，指定API控制器前缀：${prefix}`)

const router = new Router({ prefix })
router.all('/(.*)', fnCtrlWrapper)

export { router }
