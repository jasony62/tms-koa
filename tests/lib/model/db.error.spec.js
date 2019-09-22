const log4js = require('log4js')
const logger = log4js.getLogger()
logger.level = 'info'

describe('#model-数据库异常处理', function() {
    it('获得连接池失败-配置文件不存在', () => {
        let { DbContext } = require(process.cwd() + '/lib/model/db')
        return DbContext.getPool('/notexistpath/db.js').catch(err => {
            expect(err).toBe('数据库连接配置文件(/notexistpath/db.js)不存在')
        })
    })
    it('获得连接池失败-没有指定master参数', () => {
        let { DbContext } = require(process.cwd() + '/lib/model/db')
        let dbConfig = {}
        return DbContext.getPool(dbConfig).catch(err => {
            expect(err).toBe('没有指定默认数据库（master）连接参数')
        })
    })
    it('获得连接池失败-连接参数错误', () => {
        let { DbContext } = require(process.cwd() + '/lib/model/db')
        let dbConfig = {
            master: {
                host: "localhost",
                port: "4306", // 错误的端口，保证连接不上数据库
                user: "root",
                password: "",
                database: ""
            }
        }
        return DbContext.getPool(dbConfig).catch(err => {
            expect(err).toBe('建立默认数据库连接池（master）失败(ECONNREFUSED)')
        })
    })
    it('从连接池获得数据库连接失败', async done => {
        let { DbContext } = require(process.cwd() + '/lib/model/db')
        let dbConfig = {
            master: {
                connectionLimit: 1, // 限制只有1个连接
                waitForConnections: false, // 获得不到连接时不等待，立即失败
                host: "localhost",
                port: "3306", // 错误的端口，保证连接不上数据库
                user: "root",
                password: "",
                database: ""
            }
        }
        await DbContext.getConnection({ pathOrConfig: dbConfig })

        await DbContext.getConnection().catch(err => {
            expect(err).toBe(`获得默认数据库连接失败(POOL_CONNLIMIT)`)
        }).finally(() => {
            DbContext.closePool(done)
        })
    })
    it('连接池从数据库获得连接失败', async done => {
        let { DbContext } = require(process.cwd() + '/lib/model/db')
        let dbConfig = {
            master: {
                connectionLimit: 5, // 限制只有5个连接
                waitForConnections: false, // 获得不到连接时不等待，立即失败
                host: "localhost",
                port: "3306", // 错误的端口，保证连接不上数据库
                user: "root",
                password: "",
                database: ""
            }
        }
        // 需要配置先mysql的max_connections参数，设置为5
        let i = 0
        while (i < 5) {
            await DbContext.getConnection({ pathOrConfig: dbConfig })
            i++
        }

        await DbContext.getConnection().catch(err => {
            expect(err).toBe(`获得默认数据库连接失败(POOL_CONNLIMIT)`)
        }).finally(() => {
            DbContext.closePool(done)
        })
    })
    it('执行sql语句错误', async done => {
        let { Db, DbContext } = require("../../../lib/model/db")
        let ctx, db
        let dbConfig = {
            master: {
                connectionLimit: 1, // 限制只有1个连接
                waitForConnections: false, // 获得不到连接时不等待，立即失败
                host: "localhost",
                port: "3306", // 错误的端口，保证连接不上数据库
                user: "root",
                password: "",
                database: ""
            }
        }
        await DbContext.getConnection(dbConfig).then(conn => {
            ctx = new DbContext({ conn })
            db = new Db({ ctx })
        })
        let select = db.newSelect('fake_table', 'id')
        select.where.fieldMatch('id', '=', 1)
        return select.exec().catch(err => {
            expect(err).toMatch(/^执行SQL语句失败\(Table '.*\.fake_table' doesn't exist\)$/)
        }).finally(() => {
            DbContext.closePool(done)
        })
    })
})