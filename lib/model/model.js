const MODEL_CONTEXT = Symbol("model_context")

class Model {
  get context() {
    return this[MODEL_CONTEXT]
  }
  set context(ctx) {
    this[MODEL_CONTEXT] = ctx
  }
}
/**
 * 数据库表
 */
// 数据库连接实例
const DEBUG_MODE = Symbol("debug_mode")
// 数据库连接实例
const DB_INSTANCE = Symbol("db_instance")
// 表名称字段
const TABLE_NAME = Symbol("table_name")
// 表ID字段
const TABLE_ID = Symbol("table_id")
// 是否使用自增ID
const TABLE_AUTO_INC_ID = Symbol("table_auto_inc_id")

/**
 * 添加where条件
 * @param {*} dbSqlAction
 * @param {Array} whereParts
 */
function _makeWhere(dbSqlAction, whereParts) {
  if (whereParts && Array.isArray(whereParts)) {
    whereParts.forEach(part => {
      let [method, ...args] = part
      if (dbSqlAction.where[method]) {
        dbSqlAction.where[method].apply(dbSqlAction.where, args)
      }
    })
  }
  return dbSqlAction
}

class DbModel extends Model {
  /**
   *
   * @param {String} table 表名称
   */
  constructor(table, { autoIncId = true, id = "id", debug = false } = {}) {
    super()
    this[TABLE_NAME] = table
    this[TABLE_ID] = id
    this[TABLE_AUTO_INC_ID] = autoIncId
    this[DEBUG_MODE] = debug
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
    { fnForEach = false, fnMapKey = false } = {}
  ) {
    let db = await this.db()
    let dbSelect = db.newSelect(this.table, fields)

    if (Array.isArray(limit) && limit.length === 2) dbSelect.limit(...limit)

    if (typeof orderby === "string") dbSelect.order(orderby)

    if (typeof groupby === "string") dbSelect.group(groupby)

    _makeWhere(dbSelect, wheres)

    let rows = await dbSelect.exec()
    if (rows && rows.length) {
      if (typeof fnForEach === "function") rows.forEach(r => fnForEach(r))

      if (typeof fnMapKey === "function") {
        let map = new Map()
        rows.forEach(r => {
          map.set(fnMapKey(r), r)
        })
        return map
      }
    }

    return rows
  }
  /**
   * 返回1条记录
   */
  async selectOne(fields, wheres) {
    let db = await this.db()
    let dbSelect = db.newSelectOne(this.table, fields)
    _makeWhere(dbSelect, wheres)
    let row = await dbSelect.exec()

    return row
  }

  async insert(data) {
    let db = await this.db()
    let dbIns = db.newInsert(this.table, data)
    let idOrRows = await dbIns.exec(this.isAutoIncId)

    return idOrRows
  }

  async updateById(id, data) {
    let db = await this.db()
    let dbUpd = db.newUpdate(this.table, data)
    dbUpd.where.fieldMatch(this.id, "=", id)
    let rows = await dbUpd.exec()

    return rows
  }
  /**
   * 加载指定的model包
   *
   * @param {*} name
   */
  model(name) {
    let { create: fnCreate } = require(`${process.cwd()}/models/${name}`)
    let model = fnCreate()
    model.context = this.context
    // 使用同一个数据库连接
    model.db({ conn: this[DB_INSTANCE].conn })

    return model
  }
  /**
   * 设置数据库操作对象
   *
   * @param {*} param0
   */
  db({ conn = null } = {}) {
    let db
    if (this[DB_INSTANCE]) {
      db = this[DB_INSTANCE]
    } else {
      db = require("./db").create({
        conn,
        debug: this.debug,
        context: this.context
      })
      this[DB_INSTANCE] = db
    }

    return db
  }

  end(done) {
    if (this[DB_INSTANCE]) this[DB_INSTANCE].end(done)
    else if (done && typeof done === "function") done()
  }
}

module.exports = {
  Model,
  DbModel
}
