const mysql = require('mysql')
const SqlString = require('sqlstring')
const fs = require('fs')
const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-koa')

/***************************************
 * 封装SQL语句
 ***************************************/
/**
 * where条件
 */
const WhereMatchOps = ['=', '>', '>=', '<', '<=', '<>', 'like']
class WhereAssembler {
    constructor(db) {
        this.db = db
        this.pieces = []
    }

    fieldMatch(field, op, match) {
        if (WhereMatchOps.indexOf(op) === -1 || !/number|string/.test(typeof match))
            return this

        this.pieces.push(`${this.db.escapeId(field)} ${op} ${this.db.escape(match)}`)
        return this
    }

    fieldIn(field, match) {
        this.pieces.push(`${this.db.escapeId(field)} in(${this.db.escape(match)})`)
        return this
    }

    fieldNotIn(field, match) {
        this.pieces.push(`${this.db.escapeId(field)} not in(${this.db.escape(match)})`)
        return this
    }

    fieldBetween(field, match) {
        this.pieces.push(`${this.db.escapeId(field)} between ${this.db.escape(match[0])} and ${this.db.escape(match[1])}`)
        return this
    }

    fieldNotBetween(field, match) {
        this.pieces.push(`${this.db.escapeId(field)} not between ${this.db.escape(match[0])} and ${this.db.escape(match[1])}`)
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
            logger.warn('数据库连接不可用', this.sql)
            return Promise.reject('数据库连接不可用')
        }
        return new Promise((resolve, reject) => {
            conn.query(this.sql, (error, result) => {
                if (error) {
                    let msg = `执行SQL语句失败(${error.sqlMessage||error.code})`
                    logger.debug(msg, error)
                    reject(msg)
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
    constructor(db, table, data = {}) {
        super(db, table)
        this.data = data
    }

    get sql() {
        if (Object.keys(this.data).length === 0)
            throw new Error('数据错误')

        let fields = Object.keys(this.data)
        let values = fields.map(f => this.data[f])

        return `INSERT INTO ${this.table}(${this.db.escapeId(fields)}) VALUES(${this.db.escape(values)})`
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
                            let msg = `执行SQL语句失败(${error.sqlMessage||error.code})`
                            logger.debug(msg, error)
                            reject(msg)
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
            this.whereAssembler = new WhereAssembler(this.db)
        return this.whereAssembler
    }
}

class Delete extends SqlActionWithWhere {

    constructor(db, table) {
        super(db, table)
    }

    get sql() {
        return `DELETE FROM ${this.table} WHERE ${this.where.sql}`
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
            }).catch(error => {
                let msg = `执行SQL语句失败(${error.sqlMessage||error.code})`
                logger.debug(msg, error)
                return Promise.reject(msg)
            })
    }
}

class Update extends SqlActionWithWhere {

    constructor(db, table, data = {}) {
        super(db, table)
        this.data = data
    }

    get sql() {
        if (Object.keys(this.data).length === 0)
            throw new Error('数据错误')

        return `UPDATE ${this.table} SET ${this.db.escape(this.data)} WHERE ${this.where.sql}`
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
                    let msg = `执行SQL语句失败(${error.sqlMessage||error.code})`
                    logger.debug(msg, error)
                    reject(msg)
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
        return super.exec({ isWritableConn }).then((rows) => {
            if (rows.length === 1)
                return rows[0]
            else if (rows.length === 0)
                return false
            else
                return Promise.reject('查询条件错误，获得多条数据')
        })
    }
}
class SelectOneVal extends Select {
    async exec({ isWritableConn = false } = {}) {
        return super.exec({ isWritableConn }).then((rows) => {
            if (rows.length === 1)
                return Object.values(rows[0])[0]
            else if (rows.length === 0)
                return false
            else
                return Promise.reject('查询条件错误，获得多条数据')
        })
    }
}
/************************************************
 * 数据库连接管理
 ************************************************/
// 已经建立的数据库连接
let cachedMasterDbPool, cachedWritableDbPool
let dbConnCount = 0

/**
 * 获取或创建数据库连接池
 */
function getPool(oDbConfig) {
    // 只创建1次连接池
    if (cachedMasterDbPool && cachedWritableDbPool)
        return Promise.resolve([cachedMasterDbPool, cachedWritableDbPool])

    let oPoolConfig = oDbConfig.master
    let oDefaultConfig = {
        supportBigNumbers: true,
        bigNumberStrings: true
    }
    Object.assign(oPoolConfig, oDefaultConfig)

    let dbPool = mysql.createPool(oPoolConfig)
    return new Promise((resolve, reject) => {
        dbPool.query('SELECT 1 + 1', function(error) {
            if (error) {
                dbPool.end()
                reject(`建立默认数据库连接池（master）失败(${error.code})`)
            } else
                resolve(dbPool)
        });
    }).then(dbPool => {
        logger.info(`建立默认数据库（master）连接池`)
        cachedMasterDbPool = dbPool
        if (!oDbConfig.write) {
            cachedWritableDbPool = cachedMasterDbPool
            return [cachedMasterDbPool, cachedWritableDbPool]
        }
        // 单独配置了写数据库
        let oPoolConfig = oDbConfig.write
        Object.assign(oPoolConfig, oDefaultConfig)
        dbPool = mysql.createPool(oPoolConfig)
        return new Promise((resolve, reject) => {
            dbPool.query('SELECT 1 + 1', function(error) {
                if (error) {
                    dbPool.end()
                    reject(`建立写数据库（write）连接池失败(${error.code})`)
                } else
                    resolve(dbPool)
            });
        }).then(dbPool => {
            logger.info(`建立写数据库（write）连接池`)
            cachedWritableDbPool = dbPool
            return [cachedMasterDbPool, cachedWritableDbPool]
        })
    })
}
/**
 * 连接数据库
 * 
 * @param {Boolean} isWritableConn 
 * @param {Connection} backupConn
 */
function connect({ isWritableConn, conn: backupConn = null }) {
    dbConnCount++
    return new Promise((resolve, reject) => {
        let beginAt = Date.now()

        // 如果没有独立的写数据库，且指定了已有连接，就直接返回已有连接
        if (cachedMasterDbPool === cachedWritableDbPool && isWritableConn && !backupConn)
            return backupConn

        let connPool = isWritableConn ? cachedWritableDbPool : cachedMasterDbPool
        connPool.getConnection((err, conn) => {
            if (err) {
                let msg = `获得${isWritableConn?'写':'默认'}数据库连接失败(${err.code})`
                logger.warn(msg)
                logger.debug(msg, err)
                reject(msg)
            } else {
                let duration = Date.now() - beginAt
                logger.info(`获得${isWritableConn?'写':'默认'}数据库连接(${dbConnCount})(${duration}ms)(${conn.threadId})`)
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
            logger.info(`销毁数据库连接(${dbConn.threadId})`)
            dbConn.release()
            dbConn = null
        }
    }
    end(done) {
        if (this[DB_CTX_WRITABLE_CONN]) {
            let conn = this[DB_CTX_WRITABLE_CONN]
            let threadId = conn.threadId
            conn.release()
            logger.info(`关闭写数据库连接（${threadId}）`)
        }
        if (this[DB_CTX_CONN]) {
            let conn = this[DB_CTX_CONN]
            let threadId = conn.threadId
            conn.release()
            logger.info(`关闭默认数据库连接（${threadId}）`)
        }

        if (done && typeof done === 'function') done()

        delete this[EXEC_SQL_STACK]
    }
    /**
     * 获得连接池连接
     * 
     * @param {*} pathOrConfig 配置文件路径或配置
     */
    static getPool(pathOrConfig = process.cwd() + "/config/db.js") {
        let dbConfig
        if (typeof pathOrConfig === 'string') {
            if (!fs.existsSync(pathOrConfig))
                return Promise.reject(`数据库连接配置文件(${pathOrConfig})不存在`)

            dbConfig = require(pathOrConfig)
        } else if (typeof pathOrConfig === 'object')
            dbConfig = pathOrConfig
        else
            return Promise.reject('没有指定数据库连接信息')

        if (typeof dbConfig.master !== 'object')
            return Promise.reject('没有指定默认数据库（master）连接参数')

        return getPool(dbConfig)
    }

    static closePool(done) {
        return new Promise(resolve => {
            if (cachedWritableDbPool) {
                cachedWritableDbPool.end(resolve)
                cachedWritableDbPool = null
                logger.info(`关闭写数据库（write）连接池`)
            } else
                resolve(true)
        }).then(() => {
            return cachedMasterDbPool ?
                new Promise(resolve => {
                    cachedMasterDbPool.end(resolve)
                    cachedMasterDbPool = null
                    logger.info(`关闭默认数据库（master）连接池`)
                }) :
                true
        }).then(() => {
            if (done && typeof done === 'function') done()
        })
    }
    /**
     * 获得数据库连接
     * 
     * @param {*} options 
     * @param {sting} options.pathOrConfig 
     * @param {boolean} options.isWritableConn 
     * @param {Connection} options.backupConn 如果没有获得指定条件的连接，就返回这个连接
     * 
     * @return {Connection} 数据库连接
     */
    static async getConnection({ pathOrConfig = process.cwd() + "/config/db.js", isWritableConn = false, backupConn = null } = {}) {
        // 从连接池获得连接
        await DbContext.getPool(pathOrConfig)

        return await connect({ isWritableConn, backupConn })
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
            conn = await DbContext.getConnection({ isWritableConn: true, backupConn: this.ctx.conn })
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
        return this.ctx.conn ? this.ctx.conn.escape(v) : SqlString.escape(v)
    }
    escapeId(v) {
        return this.ctx.conn ? this.ctx.conn.escapeId(v) : SqlString.escapeId(v)
    }
}

module.exports = { Db, DbContext }