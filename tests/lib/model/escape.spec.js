describe('#model', function() {
    const { DbContext } = require('../../../lib/model/db')
    let dbConn
    beforeAll(async () => {
        dbConn = await DbContext.getConnection()
    })
    describe('#参数escape', function() {
        it('undefined -> NULL', () => {
            expect(dbConn.escape(undefined)).toBe('NULL')
        })
        it('null -> NULL', () => {
            expect(dbConn.escape(null)).toBe('NULL')
        })
        it('boolean -> string', () => {
            expect(dbConn.escape(false)).toBe('false')
            expect(dbConn.escape(true)).toBe('true')
        })
        it('number -> string', () => {
            expect(dbConn.escape(123)).toBe('123')
        })
        it('objects -> string pairs', () => {
            // 注意结果包含空格
            expect(dbConn.escape({ a: 'b', c: 'd' })).toBe("`a` = 'b', `c` = 'd'")
        })
        it('number arrays -> string', () => {
            // 注意结果包含空格 
            expect(dbConn.escape([1, 2, 3])).toBe("1, 2, 3")
        })
        it('string arrays -> string', () => {
            // 注意结果包含空格 
            expect(dbConn.escape(['a', 'b', 'c'])).toBe("'a', 'b', 'c'")
        })
        it('number and string mixed arrays -> string', () => {
            // 注意结果包含空格 
            expect(dbConn.escape([1, 'b', 'c'])).toBe("1, 'b', 'c'")
        })
        it('字符串两端加单引号', () => {
            let str = '0123456789abcdefghijklmnopqrstuvwxyz'
            let escaped = dbConn.escape(str)
            expect(escaped).toBe(`'${str}'`)
        })
        it('\0 空字符，字符串结束', () => {
            console.log('空字符：sup\0er')
            expect(dbConn.escape('sup\0er')).toBe("'sup\\0er'")
        })
        it('\b 退格，当前未知的前1列', () => {
            console.log('退格：sup\ber')
            expect(dbConn.escape('sup\ber')).toBe("'sup\\ber'")
        })
        it('\n 换行，下一行开头', () => {
            console.log('换行：sup\ner')
            expect(dbConn.escape('sup\ner')).toBe("'sup\\ner'")
        })
        it('\r 回车，本行开头', () => {
            console.log('回车：sup\rer')
            expect(dbConn.escape('sup\rer')).toBe("'sup\\rer'")
        })
        it('\t 制表，跳一个tab', () => {
            console.log('制表：sup\ter')
            expect(dbConn.escape('sup\ter')).toBe("'sup\\ter'")
        })
        it('\\ 反斜杠', () => {
            console.log('反斜杠：sup\\er')
            expect(dbConn.escape('sup\\er')).toBe("'sup\\\\er'")
        })
        it('\' 单引号', () => {
            console.log('单引号：sup\'er')
            expect(dbConn.escape('sup\'er')).toBe("'sup\\'er'")
        })
        it('" 双引号', () => {
            console.log('双引号：sup"er')
            expect(dbConn.escape('sup"er')).toBe("'sup\\\"er'")
        })
        it('\u001a (ascii 26) -> \\Z', () => {
            expect(dbConn.escape('Sup\u001aer')).toBe("'Sup\\Zer'")
        })
        it('中文 -> 中文', () => {
            expect(dbConn.escape('中文')).toBe("'中文'")
        })
    })
    describe('#表名，字段名escape', function() {
        it('column，添加撇号', () => {
            expect(dbConn.escapeId('id')).toBe('`id`')
        })
        it('table.column，添加撇号', () => {
            expect(dbConn.escapeId('table.id')).toBe('`table`.`id`')
        })
        it('column数组，添加撇号', () => {
            // 注意有空格
            expect(dbConn.escapeId(['id', 'name'])).toBe('`id`, `name`')
        })
    })
    afterAll(() => {
        DbContext.release(dbConn)
        DbContext.closePool()
    })
})