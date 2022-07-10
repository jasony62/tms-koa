class Model {}
/**
 * 数据库表
 */
// 数据库连接实例
const DEBUG_MODE = Symbol('debug_mode')
// 数据库连接实例
const DB_INSTANCE = Symbol('db_instance')
// 表名称字段
const TABLE_NAME = Symbol('table_name')
// 表ID字段
const TABLE_ID = Symbol('table_id')
// 是否使用自增ID
const TABLE_AUTO_INC_ID = Symbol('table_auto_inc_id')

/**
 * 添加where条件
 * @param {*} dbSqlAction
 * @param {Array} whereParts
 */
function _makeWhere(dbSqlAction, whereParts) {
  if (whereParts && Array.isArray(whereParts)) {
    whereParts.forEach((part) => {
      let [method, ...args] = part
      if (dbSqlAction.where[method]) {
        dbSqlAction.where[method].apply(dbSqlAction.where, args)
      }
    })
  }
  return dbSqlAction
}
/**
 * 数据库表
 */
export class DbModel extends Model {
  /**
   *
   * @param {string} table 表名称
   * @param {object} options
   * @param {boolean} options.autoIncId id字段为自增字段
   * @param {sting} options.id id字段的名称
   * @param {boolean} options.id id字段
   * @param {boolean} options.debug 是否用于调试
   * @param {Db} options.db 数据库实例
   *
   */
  constructor(
    table,
    { id = 'id', autoIncId = true, debug = false, db = null } = {}
  ) {
    super()
    this[TABLE_NAME] = table
    this[TABLE_ID] = id
    this[TABLE_AUTO_INC_ID] = autoIncId
    this[DEBUG_MODE] = debug
    this[DB_INSTANCE] = db
  }
  /**
   * 创建实例
   * 需要用模型的类调用该方法创建实例
   *
   * @param {*} options
   * @param {*} options.db 数据库连接实例
   * @param {*} options.debug 是否执行sql语句
   *
   * @return {DbModel} 创建的实例
   */
  static create({ db = null, debug = false }) {
    if (db === null) {
      const { DbServer } = require('tms-db')
      db = new DbServer({ debug })
    }
    let dbModelIns = Reflect.construct(this, [{ db, debug }])
    return dbModelIns
  }
  /**
   * 加载指定的model包，传递数据库实例
   *
   * @param {string} name 模型的名称（从models目录下开始）
   */
  model(name: string) {
    let path = `${process.cwd()}/models/${name}`
    let model = require(path).create({ db: this[DB_INSTANCE] })
    return model
  }

  get table() {
    return this[TABLE_NAME]
  }
  get id() {
    return this[TABLE_ID]
  }
  get isAutoIncId() {
    return this[TABLE_AUTO_INC_ID]
  }
  get debug() {
    return this[DEBUG_MODE]
  }
  get execSqlStack() {
    return this[DB_INSTANCE].execSqlStack
  }
  /**
   * 返回符合条件的记录
   *
   * @param {string} fields
   * @param {Array<Array>} wheres
   * @param {object} sqlOptions
   * @param {Array} sqlOptions.limit offset,length
   * @param {string} sqlOptions.orderby
   * @param {string} sqlOptions.groupby
   * @param {object} rowOptions 结果处理函数
   * @param {function} rowOptions.fnForEach 处理获得结果的每1行
   * @param {function} rowOptions.fnMapKey 若指定，返回结果为map，key由该方法生成
   *
   * @return {Array} rows
   */
  async select(
    fields,
    wheres,
    { limit = null, orderby = null, groupby = null } = {},
    {
      fnForEach,
      fnMapKey,
    }: { fnForEach: (any) => void; fnMapKey: (any) => void }
  ) {
    let dbSelect = this.db.newSelect(this.table, fields)

    if (Array.isArray(limit) && limit.length === 2) dbSelect.limit(...limit)

    if (typeof orderby === 'string') dbSelect.order(orderby)

    if (typeof groupby === 'string') dbSelect.group(groupby)

    _makeWhere(dbSelect, wheres)

    let rows = await dbSelect.exec()
    if (rows && rows.length) {
      if (typeof fnForEach === 'function') rows.forEach((r) => fnForEach(r))

      if (typeof fnMapKey === 'function') {
        let map = new Map()
        rows.forEach((r) => {
          map.set(fnMapKey(r), r)
        })
        return map
      }
    }

    return rows
  }
  /**
   * 返回1条记录
   *
   * @params {string} fields 返回的列
   * @param {Array<Array>} wheres
   *
   */
  async selectOne(fields, wheres) {
    let dbSelect = this.db.newSelectOne(this.table, fields)
    _makeWhere(dbSelect, wheres)
    let row = await dbSelect.exec()

    return row
  }

  async insert(data) {
    let dbIns = this.db.newInsert(this.table, data)
    let idOrRows = await dbIns.exec({ isAutoIncId: this.isAutoIncId })
    return idOrRows
  }

  async updateById(id, data) {
    let dbUpd = this.db.newUpdate(this.table, data)
    dbUpd.where.fieldMatch(this.id, '=', id)
    let rows = await dbUpd.exec()

    return rows
  }
  get db() {
    return this[DB_INSTANCE]
  }
  set db(db) {
    this[DB_INSTANCE] = db
  }
  end(done) {
    if (this[DB_INSTANCE]) this[DB_INSTANCE].end(done)
    else if (done && typeof done === 'function') done()
  }
}
