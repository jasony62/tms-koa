import fs from 'fs'
import path from 'path'
import * as Minio from 'minio'
import Debug from 'debug'
import { TmsFsDomain } from '../types/fs'

/* eslint-disable require-atomic-updates */
const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-koa-fs')

const debug = Debug('tms-koa:fs:context')

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
    debug('开启缩略图服务\n' + JSON.stringify(instance.thumbnail, null, 2))
  } else {
    debug('未开启缩略图服务')
  }
}
/**
 * 初始化文件服务域
 */
async function initDomains(instance, lfsConfig, isLocal = false) {
  const domains: any = {}
  if (lfsConfig.domains && typeof lfsConfig.domains === 'object') {
    const { domains: lfsDomains } = lfsConfig
    let configDomainNames = Object.keys(lfsDomains)
    for (let i = 0; i < configDomainNames.length; i++) {
      let name = configDomainNames[i]
      let domain = await initDomain(instance, name, lfsDomains[name], isLocal)
      if (domain) domains[name] = domain
    }
  }
  let domainNames = Object.keys(domains)
  if (domainNames.length === 0) {
    // 创建默认域
    logger.info(
      `文件服务的配置文件中未指定可用的存储域，创建默认存储域【update】`
    )
    domains.upload = await initDomain(instance, 'upload', isLocal)
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
 * 初始化单个文件服务域
 *
 * @param {*} instance
 * @param {*} name
 * @param {*} lfsDomain
 */
async function initDomain(
  instance,
  name: string,
  lfsDomain?,
  isLocal = false
): Promise<TmsFsDomain | boolean> {
  if (lfsDomain && lfsDomain.disabled === true) {
    logger.warn(`文件服务的存储域【${name}】设置为禁用，不进行初始化`)
    return false
  }
  if (isLocal === true) {
    const { rootDir } = instance
    const domainDir = `${rootDir}/${name}`
    if (!fs.existsSync(domainDir)) {
      fs.mkdirSync(domainDir, { recursive: true })
      logger.info(`创建文件服务域目录(${domainDir})`)
    }
    logger.info(`文件服务域起始目录(${domainDir})`)
  }

  const domain: TmsFsDomain = { name }

  if (lfsDomain) {
    domain.customName = !!lfsDomain.customName

    if (lfsDomain && typeof lfsDomain === 'object') {
      // 保存文件扩展信息的数据库
      await initMongoDb(domain, lfsDomain)
    }

    initACL(domain, lfsDomain)
  }

  if (instance.thumbnail) domain.thumbnail = instance.thumbnail

  logger.info(`文件服务的存储域【${name}】完成初始化`)

  return domain
}
/**
 *
 * @param {object} domain
 * @param {object} lfsConfig
 */
async function initMongoDb(domain, lfsConfig) {
  if (lfsConfig?.database?.disabled === true) {
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
/**
 * 初始化minio客户端
 * @param instance
 * @param fsConfig
 */
function initMinio(instance, fsConfig) {
  let { endPoint, port, useSSL, accessKey, secretKey } = fsConfig

  if (!endPoint || typeof endPoint !== 'string') {
    logger.warn(`文件服务minio初始化失败，没有指定endPoint`)
    return false
  }
  port = parseInt(port)
  if (!port) {
    logger.warn(`文件服务minio初始化失败，没有指定port`)
    return false
  }
  useSSL = useSSL === true
  if (!accessKey || typeof accessKey !== 'string') {
    logger.warn(`文件服务minio初始化失败，没有指定accessKey`)
    return false
  }
  if (!secretKey || typeof secretKey !== 'string') {
    logger.warn(`文件服务minio初始化失败，没有指定secretKey`)
    return false
  }

  instance.minioClient = new Minio.Client({
    endPoint,
    port,
    useSSL,
    accessKey,
    secretKey,
  })

  return true
}

// 全局单例
let _instance

export class Context {
  backService

  minioClient

  rootDir = ''

  domains

  defaultDemain
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
    let { local, minio } = fsConfig
    if (typeof local !== 'object' && typeof minio !== 'object') {
      logger.warn('文件服务配置文件中没有指定local或minio')
      return false
    }

    if (minio?.enabled === true) {
      _instance = new Context()

      debug('文件服务指定了【minio】')

      if (!initMinio(_instance, minio)) {
        logger.warn(`文件服务minio初始化失败`)
        debug(`文件服务minio初始化失败`)
        return false
      }
      if (!(await initDomains(_instance, minio))) {
        logger.warn(`文件服务minio初始化域失败`)
        debug(`文件服务minio初始化域失败`)
        return false
      }
      _instance.backService = 'minio'

      logger.info(`完成minio文件服务设置`)

      return _instance
    } else if (local?.disabled !== true) {
      _instance = new Context()

      initRootDir(_instance, local)

      initThumb(_instance, local)

      if (!(await initDomains(_instance, local, true))) {
        logger.warn(`文件服务初始化域失败`)
        return false
      }

      _instance.backService = 'local'

      logger.info(`完成local文件服务设置【rootDir=${_instance.rootDir}】`)
      return _instance
    }

    logger.warn('文件服务配置文件中没有指定local或minio被禁用')
    return false
  }

  static insSync() {
    return _instance
  }

  static ins = Context.init
}
