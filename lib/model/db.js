const mysql = require("mysql")
const fs = require("fs")
/***************************************
 * 封装SQL语句
 ***************************************/
/**
 * where条件
 */
const WhereMatchOps = ['=', '>', '>=', '<', '<=', '<>', 'like']
class WhereAssembler {
    constructor() {
        this.pieces = []
    }

    fieldMatch(field, op, match) {
        if (WhereMatchOps.indexOf(op) === -1 || !/number|string/.test(typeof match))
            return this

        this.pieces.push(`${field}${op}'${match}'`)
        return this
    }

    fieldIn(field, match) {
        this.pieces.push(`${field} in('${match.join('\',\'')}')`)
        return this
    }

    fieldNotIn(field, match) {
        this.pieces.push(`${field} not in('${match.join('\',\'')}')`)
        return this
    }

    fieldBetween(field, match) {
        this.pieces.push(`${field} between ${match[0]} and ${match[1]}`)
        return this
    }

    fieldNotBetween(field, match) {
        this.pieces.push(`${field} not between ${match[0]} and ${match[1]}`)
        return this
    }

    exists(match) {
        this.pieces.push(`exists('${match}')`)
        return this
    }

    and(match) {
        if (!Array.isArray(match) || match.length === 0)
            return this

        let subs = match.filter(sub => typeof sub === 'string')

        if (subs.length === 0)
            return this

        this.pieces.push(`(${subs.join(' and ')})`)
        return this

    }

    or(match) {
        if (!Array.isArray(match) || match.length <= 1)
            return this

        let subs = match.filter(sub => typeof sub === 'string')

        if (subs.length <= 1)
            return this

        this.pieces.push(`(${subs.join(' or ')})`)
        return this
    }

    get sql() {
        return this.pieces.join(' and ');
    }
}

class SqlAction {
    /**
     * 
     * @param {Db} db 
     * @param {string} table 
     */
    constructor(db, table) {
        this.db = db
        this.table = table
    }
    async conn() {
        let conn = await this.db.conn()
        return conn
    }
    async writableConn() {
        let conn = await this.db.writableConn()
        return conn
    }
    async exec({ isWritableConn = false } = {}) {
        if (this.db.debug) {
            this.db.execSqlStack = this.sql
            return Promise.resolve([])
        }
        let conn = isWritableConn ? await this.writableConn() : await this.conn()
        if (!conn) {
            console.log('数据库连接不可用', this.sql)
            return Promise.reject('数据库连接不可用')
        }
        return new Promise((resolve, reject) => {
            conn.query(this.sql, (error, result) => {
                if (error) {
                    reject(error)
                } else {
                    resolve(result)
                }
            })
        })
    }
}
/**
 * 插入语句
 */
class Insert extends SqlAction {
    /**
     * 
     * @param {Db} db 
     * @param {string} table 
     * @param {object} data 
     */
    constructor(db, table, data) {
        super(db, table)
        this.data = data
    }

    get sql() {
        let fields = Object.keys(this.data)
        let values = fields.map(f => this.data[f])
        if (this.doEscape) {
            fields = fields.map(f => this.db.escape(f))
            values = values.map(v => this.db.escape(v))
        }

        return `insert into ${this.table}(${fields.join(',')}) values('${values.join("','")}')`
    }
    async exec({ isAutoIncId = false } = {}) {
        if (this.db.debug) {
            this.db.execSqlStack = this.sql
            return Promise.resolve()
        }
        return this.writableConn()
            .then(conn => {
                return new Promise((resolve, reject) => {
                    conn.query(this.sql, (error, result) => {
                        if (error) {
                            reject(error)
                        } else {
                            if (isAutoIncId)
                                resolve(result.insertId)
                            else
                                resolve(result.affectedRows)
                        }
                    })
                })
            })
    }
}

class SqlActionWithWhere extends SqlAction {

    constructor(db, table) {
        super(db, table)
    }

    get where() {
        if (!this.whereAssembler)
            this.whereAssembler = new WhereAssembler()
        return this.whereAssembler
    }
}

class Delete extends SqlActionWithWhere {

    constructor(db, table) {
        super(db, table)
    }

    get sql() {
        return `delete from ${this.table} where ${this.where.sql}`
    }

    exec() {
        if (this.db.debug) {
            this.db.execSqlStack = this.sql
            return Promise.resolve(0)
        }
        return this.writableConn()
            .then(conn => {
                return new Promise((resolve, reject) => {
                    conn.query(this.sql, (error, result) => {
                        if (error) {
                            reject(error)
                        } else {
                            resolve(result.affectedRows)
                        }
                    })
                })
            }).catch(err => {
                console.log('err', err)
            })
    }
}

class Update extends SqlActionWithWhere {

    constructor(db, table, data = {}) {
        super(db, table)
        this.data = data
    }

    get sql() {
        let fields = Object.keys(this.data)
        let pairs
        if (this.doEscape) {

            pairs = fields.map(f => `${f}='${this.data[f]}'`)
        } else
            pairs = fields.map(f => `${f}='${this.data[f]}'`)

        return `update ${this.table} set ${pairs.join(",")} where ${this.where.sql}`
    }
    async exec() {
        if (this.db.debug) {
            this.db.execSqlStack = this.sql
            return Promise.resolve(0)
        }
        let conn = await this.writableConn()
        return new Promise((resolve, reject) => {
            conn.query(this.sql, (error, result) => {
                if (error) {
                    reject(error)
                } else {
                    resolve(result.affectedRows)
                }
            })
        })
    }
}

class Select extends SqlActionWithWhere {

    constructor(db, table, fields) {
        super(db, table)
        this.fields = fields
        this.groupBy = ''
        this.orderBy = ''
        this.limitVal = ''
    }

    group(group = null) {
        if (typeof group === 'string') {
            this.groupBy = ` GROUP BY ` + group
        }
    }

    order(order = null) {
        if (typeof order === 'string') {
            this.orderBy = ` ORDER BY ` + order
        }
    }

    limit(offset = null, length = null) {
        if ((typeof offset === 'number' && !isNaN(offset)) && (typeof length === 'number' && !isNaN(length))) {
            this.limitVal = ` LIMIT ${offset},${length}`
        }
    }

    get sql() {
        let sql = `SELECT ${this.fields} FROM ${this.table} WHERE ${this.where.sql}`
        if (this.groupBy)
            sql += `${this.groupBy}`
        if (this.orderBy)
            sql += `${this.orderBy}`
        if (this.limitVal)
            sql += `${this.limitVal}`
        return sql
    }
}
class SelectOne extends Select {
    async exec({ isWritableConn = false } = {}) {
        return new Promise((resolve, reject) => {
            super.exec({ isWritableConn }).then((rows) => {
                if (rows.length === 1)
                    resolve(rows[0])
                else if (rows.length === 0)
                    resolve(false)
                else
                    reject('查询条件错误，获得多条数据')
            })
        })
    }
}
class SelectOneVal extends Select {
    async exec({ isWritableConn = false } = {}) {
        return new Promise((resolve, reject) => {
            super.exec({ isWritableConn }).then((rows) => {
                if (rows.length === 1)
                    resolve(Object.values(rows[0])[0])
                else if (rows.length === 0)
                    resolve(false)
                else
                    reject('查询条件错误，获得多条数据')
            })
        })
    }
}
/************************************************
 * 数据库连接管理
 ************************************************/
// 已经建立的数据库连接
let cachedDbPool, cachedWritableDbPool
let dbConnCount = 0
/**
 * 获取或创建数据库连接池
 */
function getPool(path) {
    // 只创建1次连接池
    if (cachedDbPool && cachedWritableDbPool)
        return [cachedDbPool, cachedWritableDbPool]

    if (!fs.existsSync(path))
        return Promise.reject('数据库连接配置文件不存在')

    const oCusConfig = require(path)
    if (typeof oCusConfig.master !== 'object')
        return Promise.reject('没有指定默认数据库（master）连接参数')

    let oPoolConfig = oCusConfig.master
    let oDefaultConfig = {
        supportBigNumbers: true,
        bigNumberStrings: true
    }
    Object.assign(oPoolConfig, oDefaultConfig)

    console.log(`建立默认数据库（master）连接池`)
    let dbPool = mysql.createPool(oPoolConfig)
    cachedDbPool = dbPool
    if (!oCusConfig.write) {
        cachedWritableDbPool = cachedDbPool
    } else {
        let oPoolConfig = oCusConfig.write
        Object.assign(oPoolConfig, oDefaultConfig)
        console.log(`建立写数据库（write）连接池`)
        dbPool = mysql.createPool(oPoolConfig)
        cachedWritableDbPool = dbPool
    }

    return [cachedDbPool, cachedWritableDbPool]
}
/**
 * 连接数据库
 * 
 * @param {String} path 
 * @param {Boolean} isWritableConn 
 * @param {Connection} conn
 */
function connect({ path, isWritableConn, conn = null }) {
    dbConnCount++
    return new Promise((resolve, reject) => {
        let beginAt = Date.now()
        let [pool, writablePool] = getPool(path)

        // 如果没有独立的写数据库，且指定了已有连接，就直接返回已有连接
        if (pool === writablePool && isWritableConn && !conn)
            return conn

        let connPool = isWritableConn ? writablePool : pool
        connPool.getConnection((err, conn) => {
            if (err) {
                console.log(`连接数据库失败：`, err)
                reject(err)
            } else {
                let duration = Date.now() - beginAt
                console.log(`获得${isWritableConn?'写':'默认'}数据库连接(${dbConnCount})(${duration}ms)(${conn.threadId})`)
                resolve(conn)
            }
        })
    })
}
/**
 * 数据库访问上下文对象，用于保存连接资源、事物、跟踪信息等
 */
const DB_CTX_CONN = Symbol('db_ctx_conn')
const DB_CTX_WRITABLE_CONN = Symbol('db_ctx_writable_conn')
const DB_CTX_TRANSACTION = Symbol('db_ctx_transaction')
// 记录执行的SQL
const EXEC_SQL_STACK = Symbol('exec_sql_stack')

class DbContext {
    /**
     * 
     * @param {*} param 
     * @param {Connection} param.conn 默认数据库连接 
     * @param {Connection} param.writbleConn 写数据库连接 
     * @param {TmsTransaction} param.transaction 事物 
     */
    constructor({ conn = null, writableConn = null, transaction = null } = {}) {
        this[DB_CTX_CONN] = conn
        this[DB_CTX_WRITABLE_CONN] = writableConn
        this[DB_CTX_TRANSACTION] = transaction
    }
    get conn() {
        return this[DB_CTX_CONN]
    }
    set conn(conn) {
        this[DB_CTX_CONN] = conn
    }
    get writableConn() {
        return this[DB_CTX_WRITABLE_CONN]
    }
    set writableConn(conn) {
        this[DB_CTX_WRITABLE_CONN] = conn
    }
    get transaction() {
        return this[DB_CTX_TRANSACTION]
    }
    set transaction(trans) {
        this[DB_CTX_TRANSACTION] = trans
    }
    set execSqlStack(sql) {
        if (undefined === this[EXEC_SQL_STACK]) this[EXEC_SQL_STACK] = []
        this[EXEC_SQL_STACK].push(sql)
    }
    get execSqlStack() {
        return this[EXEC_SQL_STACK]
    }
    static release(dbConn) {
        if (dbConn) {
            console.log(`销毁数据库连接(${dbConn.threadId})`)
            dbConn.release()
            dbConn = null
        }
    }
    end(done) {
        if (this[DB_CTX_WRITABLE_CONN]) {
            let conn = this[DB_CTX_WRITABLE_CONN]
            let threadId = conn.threadId
            conn.release()
            console.log(`关闭写数据库连接（${threadId}）`)
        }
        if (this[DB_CTX_CONN]) {
            let conn = this[DB_CTX_CONN]
            let threadId = conn.threadId
            conn.release()
            console.log(`关闭默认数据库连接（${threadId}）`)
        }

        if (done && typeof done === 'function') done()

        delete this[EXEC_SQL_STACK]
    }
    static getPool(path = process.cwd() + "/config/db.js") {
        return getPool(path)
    }
    static closePool(done) {
        return new Promise(resolve => {
            cachedWritableDbPool ? cachedWritableDbPool.end(resolve) : resolve(true)
        }).then(() => {
            return cachedDbPool ? new Promise(resolve => { cachedDbPool.end(resolve) }) : true
        }).then(() => {
            if (done && typeof done === 'function') done()
        })
    }
    /**
     * 获得数据库连接
     * 
     * @param {*} options 
     * @param {sting} options.path 
     * @param {boolean} options.isWritableConn 
     * @param {Connection} options.conn 如果没有获得指定条件的连接，就返回这个连接
     * 
     * @return {Connection} 数据库连接
     */
    static async getConnection({ path = process.cwd() + "/config/db.js", isWritableConn = false, conn = null } = {}) {
        return await connect({ path, isWritableConn, conn })
    }
}
// 执行模式，debug=true连接数据库
const DEBUG_MODE = Symbol('debug_mode')
// 用户保存数据的上下文
const DB_CONTEXT = Symbol('db_context')
/**
 * 数据访问
 */
class Db {
    /**
     * 
     * @param {DbContext} ctx 
     * @param {boolean} debug 
     */
    constructor({ ctx = null, debug = false } = {}) {
        this[DB_CONTEXT] = ctx || new DbContext()
        this[DEBUG_MODE] = debug
    }
    get ctx() {
        return this[DB_CONTEXT]
    }
    /**
     * 获得默认连接
     * 
     * @param {boolean} autoCreate 
     * 
     */
    async conn(autoCreate = true) {
        let conn
        if (this.ctx.conn)
            conn = this.ctx.conn
        else if (autoCreate) {
            conn = await DbContext.getConnection({ isWritableConn: false })
            this.ctx.conn = conn
        }
        return conn
    }
    /**
     * 写数据库连接
     * 
     * @param {boolean} autoCreate 
     * 
     */
    async writableConn(autoCreate = true) {
        let conn
        if (this.ctx.writableConn)
            conn = this.ctx.writableConn
        else if (autoCreate) {
            conn = await DbContext.getConnection({ isWritableConn: true, conn: this.ctx.conn })
            this.ctx.writableConn = conn
        }

        return conn
    }
    get debug() {
        return this[DEBUG_MODE]
    }

    set execSqlStack(sql) {
        this.ctx.execSqlStack = sql
    }
    get execSqlStack() {
        return this.ctx.execSqlStack
    }
    /**
     * 通常只有单元测试时才需要使用该方法，应该用destroy关闭所有连接
     * 
     * @param {function} done 
     */
    end(done) {
        this.ctx.end(done)
    }

    newInsert(table, data) {
        return new Insert(this, table, data)
    }

    newDelete(table) {
        return new Delete(this, table)
    }

    newUpdate(table, data) {
        return new Update(this, table, data)
    }

    newSelect(table, fields) {
        return new Select(this, table, fields)
    }

    newSelectOne(table, fields) {
        return new SelectOne(this, table, fields)
    }

    newSelectOneVal(table, fields) {
        return new SelectOneVal(this, table, fields)
    }
    escape(v) {
        if (this.ctx.conn) {
            return this.ctx.conn.escape(v)
        }
        return v
    }
}

module.exports = { Db, DbContext }