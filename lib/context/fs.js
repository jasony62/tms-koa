/* eslint-disable require-atomic-updates */
const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-koa-fs')
const fs = require('fs')

// 本地文件存储起始位置
function initRootDir(instance, lfsConfig) {
  const rootDir = lfsConfig.rootDir.replace(/\/$/, '') // 如果有替换掉结尾的斜杠
  instance.rootDir = rootDir

  // TODO 应该去掉
  // excel导出文件保存目录
  if (
    typeof lfsConfig.outDir === 'string' &&
    !fs.existsSync(lfsConfig.outDir)
  ) {
    fs.mkdirSync(lfsConfig.outDir, { recursive: true })
    logger.info(`创建系统生成文件存储目录(${lfsConfig.outDir})`)
  }
}
// 文件服务的域
async function initDomains(instance, lfsConfig) {
  const domains = {}
  let domainNames
  if (lfsConfig.domains && typeof lfsConfig.domains === 'object') {
    const { domains: lfsDomains } = lfsConfig
    domainNames = Object.keys(lfsDomains)
    for (let i = 0; i < domainNames.length; i++) {
      let name = domainNames[i]
      let domain = await initDomain(instance, name, lfsDomains[name])
      domains[name] = domain
    }
  }
  if (!domainNames || domainNames.length === 0) {
    // 创建默认域
    domains.upload = await initDomain(instance, 'upload')
    domainNames = ['upload']
  }
  let { defaultDomain } = lfsConfig
  if (defaultDomain) {
    if (!domains[defaultDomain]) {
      logger.warn(`文件服务配置文件中的默认域（${defaultDomain}）不存在`)
      return false
    }
  } else {
    defaultDomain = domainNames[0]
  }

  instance.domains = domains
  instance.defaultDomain = defaultDomain

  return instance
}
// 单个域
async function initDomain(instance, name, lfsDomain) {
  const { rootDir } = instance
  if (!fs.existsSync(rootDir)) {
    const domainDir = `${rootDir}/${name}`
    fs.mkdirSync(domainDir, { recursive: true })
    logger.info(`创建文件服务域目录(${domainDir})`)
  }
  const domain = { name }

  if (lfsDomain) {
    domain.customName = !!lfsDomain.customName

    if (lfsDomain && typeof lfsDomain === 'object') {
      // 保存文件扩展信息的数据库
      await initMongoDb(domain, lfsDomain)
    }

    initBucket(domain, lfsDomain)

    initACL(domain, lfsDomain)
  }

  return domain
}

async function initMongoDb(domain, lfsConfig) {
  if (typeof lfsConfig.database !== 'object') {
    logger.warn(`文件服务配置文件中没有给域（${domain.name}）指定数据库`)
    return false
  }
  if (typeof lfsConfig.schemas !== 'object') {
    logger.warn(
      `文件服务配置文件中没有给域（${domain.name}）指定的扩展信息定义`
    )
    return false
  }

  // 数据库设置，保存文件信息
  let fsDbConfig = lfsConfig.database
  if (fsDbConfig) {
    if (typeof fsDbConfig.dialect !== 'string' || !fsDbConfig.dialect) {
      logger.warn(`文件服务配置文件中域（${domain.name}）[dialect]参数不可用`)
      return false
    }
    if (typeof fsDbConfig.source !== 'string' || !fsDbConfig.source) {
      logger.error(`文件服务配置文件中域（${domain.name}）[source]参数不可用`)
      return false
    }
    // 扩展信息设置
    let fsSchemas = lfsConfig.schemas
    const { source } = fsDbConfig
    const MongoContext = require('./mongodb').Context
    const mongoClient = await MongoContext.mongoClient(source)
    if (!mongoClient) {
      logger.error(
        `文件服务配置文件中域（${domain.name}）指定的mongodb[${source}]不可用`
      )
      return false
    }
    if (typeof fsDbConfig.database !== 'string' || !fsDbConfig.database) {
      logger.error(`文件服务配置文件中域（${domain.name}）指定[database]不可用`)
      return false
    }
    if (
      typeof fsDbConfig.file_collection !== 'string' ||
      !fsDbConfig.file_collection
    ) {
      logger.error(
        `文件服务配置文件中域（${domain.name}）指定[file_collection]不可用`
      )
      return false
    }
    domain.mongoClient = mongoClient
    domain.database = fsDbConfig.database
    domain.collection = fsDbConfig.file_collection
    domain.schemas = fsSchemas

    return domain
  }
}

function initBucket(domain, lfsDomain) {
  const { bucket } = lfsDomain
  if (bucket && bucket.path) {
    if (fs.existsSync(bucket.path)) {
      const handler = require(bucket.path)
      if (typeof handler === 'function') {
        domain.bucketHandler = handler
      }
    }
  }
}

function initACL(domain, lfsDomain) {
  // 访问控制
  const { accessControl } = lfsDomain
  if (accessControl && accessControl.path) {
    if (fs.existsSync(accessControl.path)) {
      const validator = require(accessControl.path)
      if (typeof validator === 'function') {
        domain.aclValidator = validator
      }
    }
  }

  return domain
}

class Context {
  /**
   * 检查domain是否可用
   */
  isValidDomain(name) {
    return Object.prototype.hasOwnProperty.call(this.domains, name)
  }
  getDomain(name) {
    return this.domains[name]
  }
  /**
   * 返回当前用户，当前请求对应的bucket
   *
   * @param {*} client
   * @param {string} domainName
   * @param {string} bucket
   * @param {*} request
   */
  async checkClientBucket(client, domain, bucket, request) {
    if (!domain) throw Error(`指定的域（${domain.name}）不存在`)

    if (!domain.bucketHandler) {
      return [true, bucket === undefined ? '' : bucket]
    }

    const result = await domain.bucketHandler(
      client,
      domain.name,
      bucket,
      request
    )

    return result
  }
  async checkClientACL(client, domain, bucket, path, request) {
    if (!domain) throw Error(`指定的域（${domain.name}）不存在`)

    if (!domain.aclValidator) return true

    if (!client || !path) return true

    const result = await domain.aclValidator(
      client,
      domain.name,
      bucket,
      path,
      request
    )

    return result
  }
}
Context.init = (function() {
  let _instance

  return async function(fsConfig) {
    if (_instance) return _instance

    if (typeof fsConfig.local !== 'object') {
      logger.warn(`文件服务配置文件中没有指定本地文件服务信息`)
      return false
    }
    const lfsConfig = fsConfig.local

    _instance = new Context()

    initRootDir(_instance, lfsConfig)

    if (!(await initDomains(_instance, lfsConfig))) {
      logger.warn(`文件服务初始化域失败`)
      return false
    }

    Context.insSync = function() {
      return _instance
    }

    logger.info(`完成文件服务设置。`)

    return _instance
  }
})()

Context.ins = Context.init

module.exports = { Context }
