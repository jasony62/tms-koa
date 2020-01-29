const _ = require('lodash')
const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-koa-fs-info')

/**
 * 在关系数据库中保存文件信息
 */
class SqlDbInfo {
  constructor(fsDbConn, table, schemas) {
    this.fsDbConn = fsDbConn
    this.table = table
    this.schemas = schemas
  }
  /**
   *
   * @param {*} path
   * @param {*} info
   */
  async set(path, info) {
    try {
      let stmt = this.fsDbConn.newSelectOne(this.table, '*')
      stmt.where.fieldMatch('path', '=', path)
      let beforeInfo = await stmt.exec()
      if (beforeInfo) {
        stmt = this.fsDbConn.newUpdate(this.table, info)
        stmt.where.fieldMatch('path', '=', path)
      } else {
        info.userid = this.client ? this.client.id : ''
        info.path = path
        stmt = this.fsDbConn.newInsert(this.table, info)
      }
      let affectedRow = await stmt.exec()
      if (affectedRow !== 1) {
        let msg = '设置上传文件信息失败：未知原因'
        return new Error(msg)
      }
      return info
    } catch (err) {
      return new Error(`设置上传文件信息失败：${err}`)
    }
  }
  /*
   * @param {string} path
   */
  async get(path) {
    let stmt = this.fsDbConn.newSelectOne(this.table, '*')
    stmt.where.fieldMatch('path', '=', path)
    let info = await stmt.exec()

    if (info) delete info.path

    return info
  }
}
/**
 * 在mongodb中保存文件信息
 */
class MongodbInfo {
  constructor(mongoClient, database, collection, schemas) {
    this.mongoClient = mongoClient
    this.database = database
    this.collection = collection
    this.schemas = schemas
  }
  /**
   *
   * @param {*} path
   * @param {*} info
   */
  async set(path, info) {
    const cl = this.mongoClient.db(this.database).collection(this.collection)
    const beforeInfo = await cl.find({ path }).toArray()
    if (beforeInfo.length <= 1) {
      const updatedInfo = _.omit(info, ['_id'])
      return cl
        .updateOne({ path }, { $set: updatedInfo }, { upsert: true })
        .then(() => info)
    } else {
      throw new Error(`数据错误，文件[${path}]有条信息数据`)
    }
  }
  /*
   * @param {string} path
   */
  async get(path) {
    const client = this.mongoClient
    const cl = client.db(this.database).collection(this.collection)
    const info = await cl.findOne({ path })

    return info
  }
}

class Info {
  constructor(handler) {
    this.handler = handler
  }
  get schemas() {
    return this.handler.schemas
  }
  async set(path, info) {
    return await this.handler.set(path, info)
  }
  async get(path) {
    return await this.handler.get(path)
  }
}
Info.SqlDbIns = (function() {
  let _instance

  return function(fsDb, table) {
    if (_instance) return _instance

    const sqldb = new SqlDbInfo(fsDb, table)
    const ins = new Info(sqldb)
    _instance = ins

    return _instance
  }
})()
Info.init = (function() {
  let _instance

  return async function(fsConfig) {
    if (_instance) return _instance

    if (typeof fsConfig.local !== 'object') {
      logger.warn(`文件服务配置文件中没有指定本地文件服务信息`)
      return false
    }
    if (typeof fsConfig.local.database !== 'object') {
      logger.warn(`文件服务配置文件中没有指定数据库`)
      return false
    }
    if (typeof fsConfig.local.schemas !== 'object') {
      logger.warn(`文件服务配置文件中指定的扩展信息定义不是对象`)
      return false
    }
    // 数据库设置
    let fsDbConfig = fsConfig.local.database
    if (typeof fsDbConfig.dialect !== 'string' || !fsDbConfig.dialect) {
      logger.warn(`文件服务配置文件中[dialect]参数不可用`)
      return false
    }
    if (typeof fsDbConfig.source !== 'string' || !fsDbConfig.source) {
      logger.error(`文件服务配置文件中[source]参数不可用`)
      return false
    }
    // 扩展信息设置
    let fsSchemas = fsConfig.local.schemas
    const { dialect, source } = fsDbConfig
    if (dialect === 'mongodb') {
      const MongoContext = require('../../mongodb').Context
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
      const mongo = new MongodbInfo(
        mongoClient,
        fsDbConfig.database,
        fsDbConfig.file_collection,
        fsSchemas
      )
      // eslint-disable-next-line require-atomic-updates
      _instance = new Info(mongo)
    } else if (dialect === 'sqldb') {
      let DbContext = require('tms-db').DbContext
      if (!DbContext.isAvailable(source)) {
        logger.error(`文件服务配置文件中指定的数据库[${source}]不可用`)
        return false
      }
      if (typeof fsDbConfig.file_table !== 'string' || !fsDbConfig.file_table) {
        logger.error(`文件服务配置文件中指定[file_table]不可用`)
        return false
      }
      // if (
      //   fsSchemas &&
      //   fsSchemas.some(s => typeof s.id !== 'string' || s.id.length === 0)
      // ) {
      //   logger.error(`文件服务配置文件中指定的扩展信息定义不符合要求`)
      //   return false
      // }

      let dbContext = new DbContext({ dialects: [fsDbConfig.dialect] })
      try {
        // 文件记录表
        let stmt = dbContext.db().newSelectOne('sqlite_master', '*')
        stmt.where
          .fieldMatch('type', '=', 'table')
          .fieldMatch('name', '=', fsDbConfig.file_table)
        let tbl = await stmt.exec()
        if (!tbl) {
          let columns = [
            'id integer PRIMARY KEY autoincrement',
            'userid text',
            'path text'
          ]
          if (fsSchemas) {
            fsSchemas.forEach(s => {
              columns.push(`${s.id} text`)
            })
          }
          let sqlCreateTable = `create table ${
            fsDbConfig.file_table
          }(${columns.join(',')})`
          await dbContext
            .db()
            .execSql(sqlCreateTable, { useWritableConn: true })
          logger.info(`创建文件服务数据库表[${fsDbConfig.file_table}]`)

          const sqldb = new SqlDbInfo(
            dbContext.db(),
            fsDbConfig.file_table,
            fsSchemas
          )

          // eslint-disable-next-line require-atomic-updates
          _instance = new Info(sqldb)
        }
      } catch (err) {
        logger.error(`文件服务初始化失败`, err)
      }
    }
    logger.info(`完成文件服务设置。`)

    return _instance
  }
})()

Info.ins = Info.init

module.exports = { Info }
