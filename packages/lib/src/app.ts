import dotenvFlow from 'dotenv-flow'
import fs from 'fs'
import path from 'path'
import http from 'http'
import https from 'https'
import _ from 'lodash'
import Koa from 'koa'
import { koaBody } from 'koa-body'
import koaStatic from 'koa-static'
import cors from '@koa/cors'
import log4js from '@log4js-node/log4js-api'
import Debug from 'debug'

dotenvFlow.config()

const logger = log4js.getLogger('tms-koa')

const debug = Debug('tms-koa')

// 初始化配置信息
let AppContext,
  MongoContext,
  RedisContext,
  FsContext,
  PushContext,
  SwaggerContext,
  MetricsContext,
  Neo4jContext,
  AgendaContext

/**全局上下文对象*/
const Context: any = {}

process.on('uncaughtException', (err) => {
  logger.warn('uncaughtException error:', err)
  console.log('uncaughtException error:', err)
})
process.on('unhandledRejection', (reason) => {
  logger.warn('Unhandled Rejection reason:', reason)
  console.log('Unhandled Rejection reason:', reason)
})
process.on('exit', (code) => {
  logger.info(`退出应用[code=${code}]`)
})
process.on('SIGINT', async () => {
  logger.info(`退出应用[ctrl+c]`)
  if (Neo4jContext) await Neo4jContext.close()
  process.exit()
})
process.on('SIGTERM', async () => {
  logger.info(`退出应用[kill]`)
  if (Neo4jContext) await Neo4jContext.close()
  process.exit()
})

/**配置文件存放位置*/
const ConfigDir = path.resolve(
  process.env.TMS_KOA_CONFIG_DIR || process.cwd() + '/config'
)
debug(`配置文件目录：${ConfigDir}`)
logger.info(`配置文件目录：${ConfigDir}`)

/**控制器插件配置文件位置*/
let CtrlPluginConfigDir
if (process.env.TMS_KOA_CONTROLLERS_PLUGINS_NPM_DIR) {
  const fullpath = path.resolve(process.env.TMS_KOA_CONTROLLERS_PLUGINS_NPM_DIR)
  if (fs.existsSync(fullpath) && fs.statSync(fullpath).isDirectory()) {
    CtrlPluginConfigDir = fullpath
  } else {
    logger.warn(
      `通过环境变量TMS_KOA_CONTROLLERS_PLUGINS_NPM_DIR=${fullpath}指定的控制器插件配置文件目录不是目录，无法加载数据`
    )
  }
} else {
  const fullpath = path.resolve('./ctrl_plugin_config')
  if (fs.existsSync(fullpath) && fs.statSync(fullpath).isDirectory()) {
    CtrlPluginConfigDir = fullpath
  } else {
    logger.info(`默认控制器插件配置文件目录【${fullpath}】不存在，无法加载数据`)
  }
}
/**内置账号数据存放目录*/
let ClientAccountDir
if (process.env.TMS_KOA_CLIENT_ACCOUNT_DIR) {
  const fullpath = path.resolve(process.env.TMS_KOA_CLIENT_ACCOUNT_DIR)
  if (fs.existsSync(fullpath) && fs.statSync(fullpath).isDirectory()) {
    ClientAccountDir = fullpath
  } else {
    logger.warn(
      `通过环境变量TMS_KOA_CLIENT_ACCOUNT_DIR=${fullpath}指定的账号数据文件目录不是目录，无法加载数据`
    )
  }
} else {
  const fullpath = path.resolve('./auth_client_account')
  if (fs.existsSync(fullpath) && fs.statSync(fullpath).isDirectory()) {
    ClientAccountDir = fullpath
  } else {
    logger.info(`默认账号数据文件目录【${fullpath}】不存在，无法加载数据`)
  }
}
/*
 *
 * @param {string} name - 配置名称
 * @param {object} defaultConfig - 默认配置
 *
 * @return {object} 配置数据对象
 */
async function loadConfig(name, defaultConfig?) {
  let basepath = path.resolve(ConfigDir, `${name}.js`)
  let baseConfig
  if (fs.existsSync(basepath)) {
    baseConfig = (await import(basepath)).default
    logger.info(`从[${basepath}]加载配置`)
  } else {
    logger.warn(`[${name}]配置文件[${basepath}]不存在`)
  }
  let localpath = path.resolve(ConfigDir, `${name}.local.js`)
  let localConfig
  if (fs.existsSync(localpath)) {
    localConfig = (await import(localpath)).default
    logger.info(`从[${localpath}]加载本地配置`)
  }
  if (defaultConfig || baseConfig || localConfig) {
    return _.mergeWith(
      {},
      defaultConfig,
      baseConfig,
      localConfig,
      (objValue, srcValue) => {
        if (_.isArray(objValue)) return objValue.concat(srcValue)
      }
    )
  }

  return false
}

function normalizePluginNpm(pluginNpm) {
  let { id, dir, alias, node_modules_root, node_modules } = pluginNpm
  if (typeof id === 'string' && id) {
    let np: any = { id }
    if (typeof dir === 'string' && dir) np.dir = dir
    if (typeof alias === 'string' && alias) np.alias = alias
    if (typeof node_modules_root === 'string' && node_modules_root)
      np.node_modules_root = node_modules_root
    if (node_modules === false) np.node_modules = node_modules
    return np
  }

  return false
}
function loadCtrlPluginsNpmFromEnv(appDefaultConfig: any) {
  let data = process.env.TMS_KOA_CONTROLLERS_PLUGINS_NPM
  debug(`环境变量TMS_KOA_CONTROLLERS_PLUGINS_NPM=${data}`)
  try {
    let plugins = JSON.parse(data)
    let normalized = []
    if (Array.isArray(plugins) && plugins.length) {
      plugins.forEach((p: any) => {
        let np = normalizePluginNpm(p)
        if (np) {
          normalized.push(np)
        } else {
          debug(`指定的控制器插件id=${JSON.stringify(p.id)}不是字符串`)
        }
      })
      if (normalized.length)
        _.set(appDefaultConfig, 'router.controllers.plugins_npm', normalized)
    } else {
      let logMsg = `环境变量TMS_KOA_CONTROLLERS_PLUGINS_NPM不是数组或内容为空`
      debug(logMsg)
    }
  } catch (e) {
    let logMsg = `环境变量TMS_KOA_CONTROLLERS_PLUGINS_NPM=${data}无法解析为JSON`
    debug(logMsg)
    logger.isDebugEnabled() ? logger.debug(logMsg, e) : logger.warn(logMsg)
    process.exit(0)
  }
}

function loadCtrlPluginsNpmFromDir(appDefaultConfig: any) {
  let plugins = []
  let files = fs.readdirSync(CtrlPluginConfigDir)
  files.forEach((file) => {
    let fp = path.resolve(CtrlPluginConfigDir, file)
    if (fs.statSync(fp).isFile() && /\.json$/.test(file)) {
      let data = fs.readFileSync(fp, 'utf-8')
      data = JSON.parse(data)
      if (Array.isArray(data) && data.length)
        data.forEach((p) => {
          let np = normalizePluginNpm(p)
          if (np) plugins.push(np)
        })
      else if (data !== null && typeof data === 'object') {
        let np = normalizePluginNpm(data)
        if (np) plugins.push(np)
      }
    }
  })
  logger.info(
    `从目录${CtrlPluginConfigDir}加载了${plugins.length}个控制器插件定义`
  )

  if (plugins.length) {
    const inConfig = _.get(
      appDefaultConfig,
      'router.controllers.plugins_npm',
      []
    )
    plugins.forEach((p) => inConfig.push(p))
    _.set(appDefaultConfig, 'router.controllers.plugins_npm', inConfig)
  }
}
/**检查内置账号数据是否完整*/
function validateClientAccount(account) {
  let { id, username, password } = account
  if (
    !id ||
    (typeof id !== 'string' && typeof id !== 'number') ||
    !username ||
    typeof username !== 'string' ||
    !password ||
    typeof password !== 'string'
  ) {
    return false
  }

  return account
}
function loadClientAccountFromDir(appDefaultConfig: any) {
  let accounts = []
  let files = fs.readdirSync(ClientAccountDir)
  files.forEach((file) => {
    let fp = path.resolve(ClientAccountDir, file)
    if (fs.statSync(fp).isFile() && /\.json$/.test(file)) {
      let data = fs.readFileSync(fp, 'utf-8')
      data = JSON.parse(data)
      if (Array.isArray(data) && data.length)
        data.forEach((a) => {
          let va = validateClientAccount(a)
          if (va) accounts.push(va)
        })
      else if (data !== null && typeof data === 'object') {
        let va = validateClientAccount(data)
        if (va) accounts.push(va)
      }
    }
  })
  logger.info(`从目录${ClientAccountDir}加载了${accounts.length}个账号`)

  if (accounts.length) _.set(appDefaultConfig, 'auth.client.accounts', accounts)
}

type KoaMiddleware = (ctx: any, next: Function) => void

type TmsKoaStartupOptions = {
  beforeController?: KoaMiddleware[]
  afterController?: KoaMiddleware[]
  afterInit?: (context: any) => void
}
class TmsKoa extends Koa {
  /**
   *
   * @param {*} options
   */
  // constructor(options) {
  //   super(options)
  // }
  /**
   * 启动应用
   */
  async startup(options: TmsKoaStartupOptions) {
    const { env } = process
    const { beforeController, afterController, afterInit } = options
    /**
     * 应用配置
     */
    const applog = debug.extend('app')
    const appDefaultConfig: any = {
      port: parseInt(env.TMS_KOA_APP_HTTP_PORT) || 3000,
    }
    if (env.TMS_KOA_CONTROLLERS_PREFIX) {
      _.set(
        appDefaultConfig,
        'router.controllers.prefix',
        env.TMS_KOA_CONTROLLERS_PREFIX
      )
    }
    /**通过环境变量指定存放控制器插件目录的情况*/
    if (typeof CtrlPluginConfigDir === 'string') {
      loadCtrlPluginsNpmFromDir(appDefaultConfig)
    }
    /**通过环境变量直接指定控制插件的情况*/
    if (env.TMS_KOA_CONTROLLERS_PLUGINS_NPM) {
      loadCtrlPluginsNpmFromEnv(appDefaultConfig)
    }
    applog(`应用的默认配置：\n` + JSON.stringify(appDefaultConfig, null, 2))
    const appConfig = await loadConfig('app', appDefaultConfig)
    /**从指定目录加载账号数据，覆盖配置文件中的设置*/
    if (typeof ClientAccountDir === 'string') {
      loadClientAccountFromDir(appConfig)
    }
    /**指定了无需认证直接使用的token */
    if (env.TMS_KOA_APP_AUTH_TOKEN_LOCAL) {
      const localToken = env.TMS_KOA_APP_AUTH_TOKEN_LOCAL.split(',').reduce(
        (localToken, tokenAndId) => {
          let [token, id] = tokenAndId.split(':')
          if (token && id) {
            localToken[token] = { id, data: {} }
          }
          return localToken
        },
        {}
      )
      if (Object.keys(localToken).length) {
        _.set(appConfig, 'auth.token.local', localToken)
      }
    }
    applog(`完整的应用配置信息：\n` + JSON.stringify(appConfig, null, 2))

    try {
      // AppContext = await import('./context/app').Context
      AppContext = (await import('./context/app.js')).Context
      await AppContext.init(appConfig)
      Context.AppContext = AppContext
    } catch (e) {
      let logMsg = `初始化[app]配置失败`
      applog(logMsg + '\n', JSON.stringify(e, null, 2))
      logger.isDebugEnabled() ? logger.debug(logMsg, e) : logger.warn(logMsg)
      process.exit(0)
    }
    /**
     * 初始化mongodb
     */
    let mongodbDefaultConfig: any
    if (parseInt(env.TMS_KOA_MONGODB_MASTER_PORT)) {
      let msg = '从环境变量获取mongodb默认配置：'
      let mdb: any = {
        port: parseInt(env.TMS_KOA_MONGODB_MASTER_PORT),
      }
      mdb.host = env.TMS_KOA_MONGODB_MASTER_HOST ?? 'localhost'
      msg += `port=${mdb.port},host=${mdb.host}`
      if (env.TMS_KOA_MONGODB_MASTER_USER) {
        mdb.user = env.TMS_KOA_MONGODB_MASTER_USER
        msg += `,user=${mdb.user}`
      }
      if (env.TMS_KOA_MONGODB_MASTER_PASS) {
        mdb.password = env.TMS_KOA_MONGODB_MASTER_PASS
        msg += `,pass=****`
      }
      logger.info(msg)
      debug(msg)
      mongodbDefaultConfig = { master: mdb }
    }
    const mongoConfig = await loadConfig('mongodb', mongodbDefaultConfig)
    if (mongoConfig && mongoConfig.disabled !== true) {
      try {
        MongoContext = (await import('./context/mongodb.js')).Context
        await MongoContext.init(mongoConfig)
        Context.MongoContext = MongoContext
      } catch (e) {
        let logMsg = `初始化[mongodb]配置失败`
        debug(logMsg + '\n%O', e)
        logger.isDebugEnabled() ? logger.debug(logMsg, e) : logger.warn(logMsg)
      }
    }
    debug.extend('mongodb')(
      '完成【mongodb】服务配置\n' + JSON.stringify(mongoConfig, null, 2)
    )

    /**
     * 初始化redis
     */
    const redisConfig = await loadConfig('redis')
    if (redisConfig && redisConfig.disabled !== true) {
      RedisContext = (await import('./context/redis.js')).Context
      try {
        await RedisContext.init(redisConfig)
        Context.RedisContext = RedisContext
      } catch (e) {
        let logMsg = `初始化[redis]配置失败`
        logger.isDebugEnabled() ? logger.debug(logMsg, e) : logger.warn(logMsg)
      }
    }
    debug.extend('redis')(
      '完成【redis】服务配置\n' + JSON.stringify(redisConfig, null, 2)
    )

    /**
     * 初始化neo4j
     */
    const neo4jConfig = await loadConfig('neo4j')
    if (neo4jConfig && neo4jConfig.disabled !== true) {
      Neo4jContext = (await import('./context/neo4j.js')).Context
      try {
        await Neo4jContext.init(neo4jConfig)
        Context.Neo4jContext = Neo4jContext
      } catch (e) {
        let logMsg = `初始化[neo4j]配置失败`
        logger.isDebugEnabled() ? logger.debug(logMsg, e) : logger.warn(logMsg)
      }
    }
    debug.extend('neo4j')(
      '完成【neo4j】服务配置\n' + JSON.stringify(neo4jConfig, null, 2)
    )

    /**
     * 文件管理模块初始化
     */
    const fsConfig = await loadConfig('fs')
    if (fsConfig && fsConfig.disabled !== true) {
      FsContext = (await import('./context/fs.js')).Context
      try {
        await FsContext.init(fsConfig)
        Context.FsContext = FsContext
      } catch (e) {
        let logMsg = `初始化[fs]配置失败`
        logger.isDebugEnabled() ? logger.debug(logMsg, e) : logger.warn(logMsg)
      }
    }
    if (fsConfig)
      debug.extend('fs')(
        '完成【fs】服务配置\n' + JSON.stringify(fsConfig, null, 2)
      )
    else debug.extend('fs')('没有配置数据，未启动【fs】服务')

    /**
     * 推送服务模块初始化
     */
    const pushConfig = await loadConfig('push')
    if (pushConfig && pushConfig.disabled !== true) {
      PushContext = (await import('./context/push.js')).Context
      try {
        await PushContext.init(pushConfig)
        Context.PushContext = PushContext
      } catch (e) {
        let logMsg = `初始化[push]配置失败`
        logger.isDebugEnabled() ? logger.debug(logMsg, e) : logger.warn(logMsg)
      }
    }
    debug.extend('push')(
      '完成【push】服务配置\n',
      JSON.stringify(pushConfig, null, 2)
    )

    /**
     * Agenda服务模块初始化
     */
    const agendaConfig = await loadConfig('agenda')
    if (agendaConfig && agendaConfig.disabled !== true) {
      AgendaContext = (await import('./context/agenda.js')).Context
      try {
        await AgendaContext.init(agendaConfig)
        Context.AgendaContext = AgendaContext
      } catch (e) {
        let logMsg = `初始化[agenda]配置失败`
        logger.isDebugEnabled() ? logger.debug(logMsg, e) : logger.warn(logMsg)
      }
    }
    debug.extend('agenda')(
      '完成【agenda】服务配置\n',
      JSON.stringify(agendaConfig, null, 2)
    )

    /**
     * Swagger服务模块初始化
     */
    const swaggerConfig = await loadConfig('swagger')
    if (swaggerConfig && swaggerConfig.disabled !== true) {
      SwaggerContext = (await import('./context/swagger.js')).Context
      try {
        await SwaggerContext.init(swaggerConfig)
        Context.SwaggerContext = SwaggerContext
      } catch (e) {
        let logMsg = `初始化[swagger]配置失败`
        logger.isDebugEnabled() ? logger.debug(logMsg, e) : logger.warn(logMsg)
      }
    }
    debug.extend('swagger')(
      '完成数据【swagger】配置\n',
      JSON.stringify(swaggerConfig, null, 2)
    )

    /**
     * 监控服务
     */
    const metricsConfig = await loadConfig('metrics')
    if (metricsConfig && metricsConfig.disabled !== true) {
      MetricsContext = (await import('./context/metrics.js')).Context
      try {
        await MetricsContext.init(metricsConfig)
        Context.MetricsContext = MetricsContext
      } catch (e) {
        let logMsg = `初始化[metrics]配置失败`
        logger.isDebugEnabled() ? logger.debug(logMsg, e) : logger.warn(logMsg)
      }
    }
    debug.extend('metrics')(
      '完成数据【metrics】配置\n',
      JSON.stringify(metricsConfig, null, 2)
    )

    /**
     * 支持跨域
     */
    const corsOptions = _.get(AppContext.insSync(), 'cors')
    this.use(cors(corsOptions))
    /**
     * 开放Swagger服务
     */
    if (Context.SwaggerContext) {
      let { router } = await import('./swagger/router.js')
      this.use(router.routes())
    }
    /**
     * 开放监控服务
     */
    if (Context.MetricsContext) {
      let { router } = await import('./metrics/router.js')
      this.use(router.routes())
    }
    /**
     * 支持访问静态文件
     */
    let staticPath = process.cwd() + '/public'
    if (fs.existsSync(staticPath)) {
      this.use(koaStatic(staticPath))
    }
    /**
     * 开放文件服务的下载服务
     */
    if (Context.FsContext) {
      let { router } = await import('./fsdomain/router.js')
      this.use(router.routes())
    }
    /**
     * 支持post，上传文件
     */
    const koaBodyOptions = {
      jsonLimit: appConfig.body?.jsonLimit || '1mb', // {String|Integer} The byte (if integer) limit of the JSON body, default 1mb
      formLimit: appConfig.body?.formLimit || '56kb',
      textLimit: appConfig.body?.textLimit || '56kb',
      multipart: true,
      formidable: {
        maxFileSize: appConfig.body?.maxFileSize ?? '200mb',
      },
    }
    this.use(koaBody(koaBodyOptions))

    /**
     * 获得access_token
     */
    const authConfig = _.get(AppContext.insSync(), 'auth')
    if (
      authConfig &&
      typeof authConfig === 'object' &&
      Object.keys(authConfig).length
    ) {
      let { router } = await import('./auth/router.js')
      this.use(router.routes())
      if (authConfig.mode)
        logger.info(`启用API调用认证机制【mode=${authConfig.mode}】`)
      if (authConfig.captcha && authConfig.captcha.disabled !== true) {
        logger.info(`启用验证码服务【mode=${authConfig.captcha.mode}】`)
      } else {
        logger.info(`未启用验证码服务`)
      }
    }
    /**
     * 其他中间件
     */
    if (Array.isArray(beforeController)) {
      beforeController.forEach((m) => this.use(m))
    }
    /**
     * 控制器
     */
    let { router } = await import('./controller/router.js')
    this.use(router.routes())
    /**
     * 其他中间件
     */
    if (Array.isArray(afterController)) {
      afterController.forEach((m) => this.use(m))
    }
    /**
     * 初始化完成后
     */
    if (afterInit && typeof afterInit === 'function') {
      await afterInit(Context)
    }

    /**
     * 启用端口
     */
    const serverCallback = this.callback()
    const appContext = AppContext.insSync()
    try {
      const httpServer = http.createServer(serverCallback)
      httpServer.listen(appContext.port, () => {
        let msg = `完成启动http端口：${appContext.port}`
        debug(msg)
        logger.info(msg)
      })
      httpServer.on('error', (err) => {
        if (err) {
          let msg = `启动http端口【${appContext.port}】失败: `
          debug(msg + '%O', err)
          logger.error(msg, err)
        }
      })
    } catch (ex) {
      let msg = '启动http服务失败\n'
      debug(msg + '%O', ex)
      logger.error(msg, ex, ex && ex.stack)
    }
    /**
     * 支持https
     */
    if (
      typeof appContext.https === 'object' &&
      appContext.https.disabled !== true
    ) {
      const { port, key, cert } = appContext.https
      try {
        const httpsServer = https.createServer(
          {
            key: fs.readFileSync(key, 'utf8').toString(),
            cert: fs.readFileSync(cert, 'utf8').toString(),
          },
          serverCallback
        )
        httpsServer.listen(port, () => {
          logger.info(`完成启动https端口：${port}`)
        })
        httpsServer.on('error', (err) => {
          if (err) {
            logger.error(`启动https端口【${port}】失败: `, err)
          }
        })
      } catch (ex) {
        logger.error('启动https服务失败\n', ex, ex && ex.stack)
      }
    }
  }
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
 * 对外接口
 */
export { TmsKoa, Context, loadConfig, getAccessTokenByRequest }
