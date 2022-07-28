const fs = require('fs')
const path = require('path')
const http = require('http')
const https = require('https')
const _ = require('lodash')
const Koa = require('koa')
const koaBody = require('koa-body')
const koaStatic = require('koa-static')
const cors = require('@koa/cors')
const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-koa')
const Debug = require('debug')

require('dotenv-flow').config()

const debug = Debug('tms-koa:app')

// 初始化配置信息
let AppContext,
  DbContext,
  MongoContext,
  RedisContext,
  FsContext,
  PushContext,
  SwaggerContext,
  MetricsContext,
  Neo4jContext

const Context: any = {}

process.on('uncaughtException', (err) => {
  logger.warn('uncaughtException error:', err)
})
process.on('unhandledRejection', (reason) => {
  logger.warn('Unhandled Rejection reason:', reason)
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
const ConfigDir = process.env.TMS_KOA_CONFIG_DIR || process.cwd() + '/config'
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
function loadConfig(name, defaultConfig?) {
  let basepath = path.resolve(ConfigDir, `${name}.js`)
  let baseConfig
  if (fs.existsSync(basepath)) {
    baseConfig = require(basepath)
    logger.info(`从[${basepath}]加载配置`)
  } else {
    logger.warn(`[${name}]配置文件[${basepath}]不存在`)
  }
  let localpath = path.resolve(ConfigDir, `${name}.local.js`)
  let localConfig
  if (fs.existsSync(localpath)) {
    localConfig = require(localpath)
    logger.info(`从[${localpath}]加载本地配置`)
  }
  if (defaultConfig || baseConfig || localConfig) {
    return _.merge({}, defaultConfig, baseConfig, localConfig)
  }

  return false
}

function normalizePluginNpm(pluginNpm) {
  let { id, dir, alias } = pluginNpm
  if (typeof id === 'string' && id) {
    let np: any = { id }
    if (typeof dir === 'string' && dir) np.dir = dir
    if (typeof alias === 'string' && alias) np.alias = alias
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

class TmsKoa extends Koa {
  /**
   *
   * @param {*} options
   */
  constructor(options) {
    super(options)
  }
  /**
   * 启动应用
   */
  async startup({
    beforeController,
    afterController,
    afterInit,
  }: {
    beforeController: KoaMiddleware[]
    afterController: KoaMiddleware[]
    afterInit: (context: any) => void
  }) {
    logger.info(`配置文件获取目录：${ConfigDir}`)
    const { env } = process
    /**
     * 应用配置
     */
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
    /**从指定目录加载账号数据*/
    if (typeof ClientAccountDir === 'string') {
      loadClientAccountFromDir(appDefaultConfig)
    }
    debug(`应用的默认配置：\n` + JSON.stringify(appDefaultConfig, null, 2))
    const appConfig = loadConfig('app', appDefaultConfig)
    debug(`完整的应用配置信息：\n` + JSON.stringify(appConfig, null, 2))

    try {
      AppContext = require('./context/app').Context
      await AppContext.init(appConfig)
      Context.AppContext = AppContext
    } catch (e) {
      let logMsg = `初始化[app]配置失败`
      debug(logMsg + '\n', JSON.stringify(e, null, 2))
      logger.isDebugEnabled() ? logger.debug(logMsg, e) : logger.warn(logMsg)
      process.exit(0)
    }
    /**
     * 启动数据库连接池
     */
    const dbConfig = loadConfig('db')
    if (dbConfig && dbConfig.disabled !== true) {
      DbContext = require('tms-db').DbContext
      try {
        await DbContext.init(dbConfig)
        Context.DbContext = DbContext
      } catch (e) {
        let logMsg = `初始化[db]配置失败`
        logger.isDebugEnabled() ? logger.debug(logMsg, e) : logger.warn(logMsg)
      }
    }

    /**
     * 初始化mongodb
     */
    let mongodbDefaultConfig: any
    if (parseInt(process.env.TMS_KOA_MONGODB_MASTER_PORT)) {
      let msg = '从环境变量获取mongodb默认配置：'
      let mdb: any = {
        port: parseInt(process.env.TMS_KOA_MONGODB_MASTER_PORT),
      }
      mdb.host = process.env.TMS_KOA_MONGODB_MASTER_HOST ?? 'localhost'
      msg += `port=${mdb.port},host=${mdb.host}`
      if (process.env.TMS_KOA_MONGODB_MASTER_USER) {
        mdb.user = process.env.TMS_KOA_MONGODB_MASTER_USER
        msg += `,user=${mdb.user}`
      }
      if (process.env.TMS_KOA_MONGODB_MASTER_PASS) {
        mdb.password = process.env.TMS_KOA_MONGODB_MASTER_PASS
        msg += `,pass=****`
      }
      logger.info(msg)
      debug(msg)
      mongodbDefaultConfig = { master: mdb }
    }
    const mongoConfig = loadConfig('mongodb', mongodbDefaultConfig)
    if (mongoConfig && mongoConfig.disabled !== true) {
      try {
        MongoContext = require('./context/mongodb').Context
        await MongoContext.init(mongoConfig)
        Context.MongoContext = MongoContext
      } catch (e) {
        let logMsg = `初始化[mongodb]配置失败`
        debug(logMsg + '\n', JSON.stringify(e, null, 2))
        logger.isDebugEnabled() ? logger.debug(logMsg, e) : logger.warn(logMsg)
      }
    }

    /**
     * 初始化redis
     */
    const redisConfig = loadConfig('redis')
    if (redisConfig && redisConfig.disabled !== true) {
      RedisContext = require('./context/redis').Context
      try {
        await RedisContext.init(redisConfig)
        Context.RedisContext = RedisContext
      } catch (e) {
        let logMsg = `初始化[redis]配置失败`
        logger.isDebugEnabled() ? logger.debug(logMsg, e) : logger.warn(logMsg)
      }
    }

    /**
     * 初始化neo4j
     */
    const neo4jConfig = loadConfig('neo4j')
    if (neo4jConfig && neo4jConfig.disabled !== true) {
      Neo4jContext = require('./context/neo4j').Context
      try {
        await Neo4jContext.init(neo4jConfig)
        Context.Neo4jContext = Neo4jContext
      } catch (e) {
        let logMsg = `初始化[neo4j]配置失败`
        logger.isDebugEnabled() ? logger.debug(logMsg, e) : logger.warn(logMsg)
      }
    }

    /**
     * 文件管理模块初始化
     */
    const fsConfig = loadConfig('fs')
    if (fsConfig && fsConfig.disabled !== true) {
      FsContext = require('./context/fs').Context
      try {
        await FsContext.init(fsConfig)
        Context.FsContext = FsContext
      } catch (e) {
        let logMsg = `初始化[fs]配置失败`
        logger.isDebugEnabled() ? logger.debug(logMsg, e) : logger.warn(logMsg)
      }
    }

    /**
     * 推送服务模块初始化
     */
    const pushConfig = loadConfig('push')
    if (pushConfig && pushConfig.disabled !== true) {
      PushContext = require('./context/push').Context
      try {
        await PushContext.init(pushConfig)
        Context.PushContext = PushContext
      } catch (e) {
        let logMsg = `初始化[push]配置失败`
        logger.isDebugEnabled() ? logger.debug(logMsg, e) : logger.warn(logMsg)
      }
    }

    /**
     * Swagger服务模块初始化
     */
    const swaggerConfig = loadConfig('swagger')
    if (swaggerConfig && swaggerConfig.disabled !== true) {
      SwaggerContext = require('./context/swagger').Context
      try {
        await SwaggerContext.init(swaggerConfig)
        Context.SwaggerContext = SwaggerContext
      } catch (e) {
        let logMsg = `初始化[swagger]配置失败`
        logger.isDebugEnabled() ? logger.debug(logMsg, e) : logger.warn(logMsg)
      }
    }

    /**
     * 监控服务
     */
    const metricsConfig = loadConfig('metrics')
    if (metricsConfig && metricsConfig.disabled !== true) {
      MetricsContext = require('./context/metrics').Context
      try {
        await MetricsContext.init(metricsConfig)
        Context.MetricsContext = MetricsContext
      } catch (e) {
        let logMsg = `初始化[metrics]配置失败`
        logger.isDebugEnabled() ? logger.debug(logMsg, e) : logger.warn(logMsg)
      }
    }

    /**
     * 支持跨域
     */
    const corsOptions = _.get(AppContext.insSync(), 'cors')
    this.use(cors(corsOptions))
    /**
     * 开放Swagger服务
     */
    if (Context.SwaggerContext) {
      let swaggerRouter = require('./swagger/router')
      this.use(swaggerRouter.routes())
    }
    /**
     * 开放监控服务
     */
    if (Context.MetricsContext) {
      let metricsRouter = require('./metrics/router')
      this.use(metricsRouter.routes())
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
      let diskRouter = require('./fsdomain/router')
      this.use(diskRouter.routes())
    }
    /**
     * 支持post，上传文件
     */
    this.use(
      koaBody({
        jsonLimit: (appConfig.body && appConfig.body.jsonLimit) || '1mb', // {String|Integer} The byte (if integer) limit of the JSON body, default 1mb
        formLimit: (appConfig.body && appConfig.body.formLimit) || '56kb', // {String|Integer} The byte (if integer) limit of the form body, default 56kb
        textLimit: (appConfig.body && appConfig.body.textLimit) || '56kb', // {String|Integer} The byte (if integer) limit of the text body, default 56kb
        multipart: true,
        formidable: {
          maxFileSize: 200 * 1024 * 1024,
        },
      })
    )

    /**
     * 获得access_token
     */
    const authConfig = _.get(AppContext.insSync(), 'auth')
    if (typeof authConfig === 'object' && Object.keys(authConfig).length) {
      let router = require('./auth/router')
      this.use(router.routes())
      if (authConfig.mode)
        logger.info(`启用API调用认证机制[${authConfig.mode}]`)
      if (authConfig.captcha) logger.info(`启用验证码服务`)
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
    let router = require('./controller/router')
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
    let serverCallback = this.callback()
    const appContext = AppContext.insSync()
    try {
      const httpServer = http.createServer(serverCallback)
      httpServer.listen(appContext.port, (err) => {
        if (err) {
          let msg = `启动http端口【${appContext.port}】失败: `
          debug(msg + '%O', err)
          logger.error(msg, err)
        } else {
          let msg = `完成启动http端口：${appContext.port}`
          debug(msg)
          logger.info(msg)
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
        httpsServer.listen(port, (err) => {
          if (err) {
            logger.error(`启动https端口【${port}】失败: `, err)
          } else {
            logger.info(`完成启动https端口：${port}`)
          }
        })
      } catch (ex) {
        logger.error('启动https服务失败\n', ex, ex && ex.stack)
      }
    }
  }
}
/**
 * 对外接口
 */
export { TmsKoa, Context, loadConfig }
