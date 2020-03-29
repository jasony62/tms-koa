/* eslint-disable require-atomic-updates */
const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-koa-fs')
const fs = require('fs')

/**
 * 指定文件服务的本地目录
 *
 * @param {*} instance
 * @param {*} lfsConfig
 */
function initDomain(instance, lfsConfig) {
  // 本地文件存储起始位置
  const rootDir = lfsConfig.rootDir.replace(/\/$/, '') // 如果有替换掉结尾的斜杠
  instance.rootDir = rootDir

  const domains = []
  if (lfsConfig.domain && typeof lfsConfig.domain === 'object') {
    const { domain: lfsDomain } = lfsConfig
    if (
      typeof lfsDomain.defaultDomain === 'string' &&
      lfsDomain.defaultDomain
    ) {
      instance.defaultDomain = lfsDomain.defaultDomain
    } else {
      instance.defaultDomain = 'upload'
    }
    if (Array.isArray(lfsDomain.valid) && lfsDomain.valid.length) {
      if (lfsDomain.valid.indexOf(instance.defaultDomain) === -1)
        domains.push(instance.defaultDomain)
      lfsDomain.valid.forEach(d => domains.push(d))
    } else {
      domains.push(instance.defaultDomain)
    }
  } else {
    // 默认用upload
    instance.defaultDomain = 'upload'
    domains.push('upload')
  }
  // 创建默认文件服务目录
  domains.forEach(domain => {
    if (!fs.existsSync(rootDir)) {
      const domainDir = `${rootDir}/${domain}`
      fs.mkdirSync(domainDir, { recursive: true })
      logger.info(`创建上传文件存储目录(${domainDir})`)
    }
  })
  instance.domains = domains

  // excel导出文件保存目录
  if (
    typeof lfsConfig.outDir === 'string' &&
    !fs.existsSync(lfsConfig.outDir)
  ) {
    fs.mkdirSync(lfsConfig.outDir, { recursive: true })
    logger.info(`创建系统生成文件存储目录(${lfsConfig.outDir})`)
  }

  return instance
}

async function initMongoDb(instance, lfsConfig) {
  if (typeof lfsConfig.database !== 'object') {
    logger.warn(`文件服务配置文件中没有指定数据库`)
    return false
  }
  if (typeof lfsConfig.schemas !== 'object') {
    logger.warn(`文件服务配置文件中指定的扩展信息定义不是对象`)
    return false
  }

  // 数据库设置，保存文件信息
  let fsDbConfig = lfsConfig.database
  if (fsDbConfig) {
    if (typeof fsDbConfig.dialect !== 'string' || !fsDbConfig.dialect) {
      logger.warn(`文件服务配置文件中[dialect]参数不可用`)
      return false
    }
    if (typeof fsDbConfig.source !== 'string' || !fsDbConfig.source) {
      logger.error(`文件服务配置文件中[source]参数不可用`)
      return false
    }
    // 扩展信息设置
    let fsSchemas = lfsConfig.schemas
    const { source } = fsDbConfig
    const MongoContext = require('./mongodb').Context
    const mongoClient = await MongoContext.mongoClient(source)
    if (!mongoClient) {
      logger.error(`文件服务配置文件中指定的mongodb[${source}]不可用`)
      return false
    }
    if (typeof fsDbConfig.database !== 'string' || !fsDbConfig.database) {
      logger.error(`文件服务配置文件中指定[database]不可用`)
      return false
    }
    if (
      typeof fsDbConfig.file_collection !== 'string' ||
      !fsDbConfig.file_collection
    ) {
      logger.error(`文件服务配置文件中指定[file_collection]不可用`)
      return false
    }
    instance.mongoClient = mongoClient
    instance.database = fsDbConfig.database
    instance.collection = fsDbConfig.file_collection
    instance.schemas = fsSchemas

    return instance
  }
}

function initBucket(instance, lfsConfig) {
  const { bucket } = lfsConfig
  if (bucket && bucket.module) {
    if (fs.existsSync(bucket.module)) {
      const handler = require(bucket.module)
      if (typeof handler === 'function') {
        instance.bucketHandler = handler
      }
    }
  }
}

function initAcl(instance, lfsConfig) {
  // 访问控制
  const { accessControl } = lfsConfig
  if (accessControl && accessControl.module) {
    if (fs.existsSync(accessControl.module)) {
      const validator = require(accessControl.module)
      if (typeof validator === 'function') {
        instance.aclValidator = validator
      }
    }
  }

  return instance
}

class Context {
  /**
   * 检查domain是否可用
   */
  isValidDomain(domain) {
    return this.domains.indexOf(domain) >= 0
  }
  /**
   * 返回当前用户，当前请求对应的bucket
   *
   * @param {*} client
   * @param {string} domain
   * @param {string} bucket
   * @param {*} request
   */
  async checkClientBucket(client, domain, bucket, request) {
    if (!this.bucketHandler) {
      return [true, bucket === undefined ? '' : bucket]
    }

    const result = await this.bucketHandler(client, domain, bucket, request)

    return result
  }
  async checkClientACL(client, domain, bucket, path, request) {
    if (!this.aclValidator) return true

    if (!client || !path) return true

    const result = await this.aclValidator(
      client,
      domain,
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

    initDomain(_instance, lfsConfig)

    _instance.customName = !!lfsConfig.customName

    initBucket(_instance, lfsConfig)

    initAcl(_instance, lfsConfig)

    initMongoDb(_instance, lfsConfig)

    Context.insSync = function() {
      return _instance
    }

    logger.info(`完成文件服务设置。`)

    return _instance
  }
})()

Context.ins = Context.init

module.exports = { Context }
