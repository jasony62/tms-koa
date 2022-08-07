/* eslint-disable require-atomic-updates */
const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-koa-fs')
const fs = require('fs')
const path = require('path')

// 本地文件存储起始位置
function initRootDir(instance, lfsConfig) {
  const rootDir = lfsConfig.rootDir.replace(/\/$/, '') // 如果有替换掉结尾的斜杠
  instance.rootDir = path.resolve(rootDir)

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
/**
 * 创建缩略图
 */
function initThumb(instance, lfsConfig) {
  const { thumbnail } = lfsConfig
  if (
    thumbnail &&
    typeof thumbnail === 'object' &&
    thumbnail.disabled !== true
  ) {
    instance.thumbnail = {}
    const { dir, width, height } = thumbnail
    if (dir && typeof dir === 'string') {
      if (/\//.test(dir))
        logger.warn(`缩略图目录参数不允许包含反斜杠，系统已自动去除`)
      instance.thumbnail.dir = dir.replace(/\//, '')
    }
    if (parseInt(width)) instance.thumbnail.width = parseInt(width)
    if (parseInt(height)) instance.thumbnail.height = parseInt(height)

    logger.info(`创建缩略图服务(${JSON.stringify(instance.thumbnail)})`)
  }
}
/**
 * 文件服务的域
 */
async function initDomains(instance, lfsConfig) {
  const domains: any = {}
  if (lfsConfig.domains && typeof lfsConfig.domains === 'object') {
    const { domains: lfsDomains } = lfsConfig
    let configDomainNames = Object.keys(lfsDomains)
    for (let i = 0; i < configDomainNames.length; i++) {
      let name = configDomainNames[i]
      let domain = await initDomain(instance, name, lfsDomains[name])
      if (domain) domains[name] = domain
    }
  }
  let domainNames = Object.keys(domains)
  if (domainNames.length === 0) {
    // 创建默认域
    logger.info(
      `文件服务的配置文件中未指定可用的存储域，创建默认存储域【update】`
    )
    domains.upload = await initDomain(instance, 'upload')
    domainNames = ['upload']
  }
  let { defaultDomain } = lfsConfig
  if (defaultDomain) {
    if (!domains[defaultDomain]) {
      logger.warn(`文件服务配置文件中的默认域【${defaultDomain}】不存在`)
      return false
    }
  } else {
    defaultDomain = domainNames[0]
  }

  instance.domains = domains
  instance.defaultDomain = defaultDomain

  return instance
}
/**
 * 初始化单个域
 *
 * @param {*} instance
 * @param {*} name
 * @param {*} lfsDomain
 */
async function initDomain(instance, name: string, lfsDomain?) {
  if (lfsDomain && lfsDomain.disabled === true) {
    logger.warn(`文件服务的存储域【${name}】设置为禁用，不进行初始化`)
    return false
  }
  const { rootDir } = instance
  const domainDir = `${rootDir}/${name}`
  if (!fs.existsSync(domainDir)) {
    fs.mkdirSync(domainDir, { recursive: true })
    logger.info(`创建文件服务域目录(${domainDir})`)
  }
  const domain: any = { name }

  if (lfsDomain) {
    domain.customName = !!lfsDomain.customName

    if (lfsDomain && typeof lfsDomain === 'object') {
      // 保存文件扩展信息的数据库
      await initMongoDb(domain, lfsDomain)
    }

    initACL(domain, lfsDomain)
  }

  logger.info(`文件服务的存储域【${name}】完成初始化`)

  return domain
}
/**
 *
 * @param {object} domain
 * @param {object} lfsConfig
 */
async function initMongoDb(domain, lfsConfig) {
  if (
    typeof lfsConfig.database !== 'object' ||
    lfsConfig.database.disabled === true
  ) {
    logger.warn(`文件服务配置文件中没有给域（${domain.name}）指定数据库`)
    return false
  }
  // if (typeof lfsConfig.schemas !== 'object') {
  //   logger.warn(
  //     `文件服务配置文件中没有给域（${domain.name}）指定的扩展信息定义`
  //   )
  //   return false
  // }

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

    // 扩展信息设置
    let fsSchemas = lfsConfig.schemas
    if (fsSchemas) {
      let { schemasRootName } = lfsConfig
      domain.schemas = fsSchemas
      if (schemasRootName && typeof schemasRootName === 'string')
        domain.schemasRootName = schemasRootName
    }

    return domain
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

// 全局单例
let _instance

export class Context {
  domains
  /**
   * 检查domain是否可用
   */
  isValidDomain(name) {
    return Object.prototype.hasOwnProperty.call(this.domains, name)
  }
  getDomain(name) {
    return this.domains[name]
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

  static async init(fsConfig) {
    if (_instance) return _instance

    if (typeof fsConfig.local !== 'object') {
      logger.warn(`文件服务配置文件中没有指定本地文件服务信息`)
      return false
    }
    const lfsConfig = fsConfig.local

    _instance = new Context()

    initRootDir(_instance, lfsConfig)

    initThumb(_instance, lfsConfig)

    if (!(await initDomains(_instance, lfsConfig))) {
      logger.warn(`文件服务初始化域失败`)
      return false
    }

    logger.info(`完成文件服务设置【rootDir=${_instance.rootDir}】`)

    return _instance
  }

  static insSync() {
    return _instance
  }

  static ins = Context.init
}
