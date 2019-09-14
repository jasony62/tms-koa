describe("#tms", function() {
    describe("#db.js", function() {
        let db
        test("connect", () => {
            let { Db, create: fnCreate } = require("../../tms/db")
            return Db.getConnection().then(conn => {
                db = fnCreate({ conn })
                expect(db.conn).not.toBe(false)
            })
        })
        describe("#Where", function() {
            let select, where
            beforeAll(() => {
                select = db.newSelect('test', 'a,b,c')
                where = select.where;
            })
            test("field=match", () => {
                where.fieldMatch('f', '=', 'a')
                expect(where.pieces[0]).toBe(`f='a'`)
            })
            test("field in(match)", () => {
                where.fieldIn('f', ['a', 'b', 'c'])
                expect(where.pieces[1]).toBe(`f in('a','b','c')`)
            })
            test("field not in(match)", () => {
                where.fieldNotIn('f', ['a', 'b', 'c'])
                expect(where.pieces[2]).toBe(`f not in('a','b','c')`)
            })
            test("field between match0 and match1", () => {
                where.fieldBetween('f', [1, 2])
                expect(where.pieces[3]).toBe(`f between 1 and 2`)
            })
            test("field not between match0 and match1", () => {
                where.fieldNotBetween('f', [1, 2])
                expect(where.pieces[4]).toBe(`f not between 1 and 2`)
            })
            test("exists", () => {
                where.exists('select c from t')
                expect(where.pieces[5]).toBe(`exists('select c from t')`)
            })
            test("and", () => {
                where.and(['a=1', 'b=2'])
                expect(where.pieces[6]).toBe(`(a=1 and b=2)`)
            })
            test("or", () => {
                where.or(['a=1', 'b=2'])
                expect(where.pieces[7]).toBe(`(a=1 or b=2)`)
            })
            test("where", () => {
                expect(where.sql).toBe(`f='a' and f in('a','b','c') and f not in('a','b','c') and f between 1 and 2 and f not between 1 and 2 and exists('select c from t') and (a=1 and b=2) and (a=1 or b=2)`)
            })
        })
        describe("#Select", function() {
            let select
            beforeAll(() => {
                select = db.newSelect('account_group', 'group_id,group_name')
                select.where.fieldMatch('group_id', '=', 1);
            })
            test("sql", () => {
                expect(select.sql).toMatch(/^select group_id,group_name from account_group where group_id='1'$/i)
            })
            test("execute", async () => {
                return select.exec().then(result => {
                    expect(result[0].group_name).toBe('初级用户')
                })
            })
        })
        describe("#Insert", function() {
            let insAct;
            beforeAll(() => {
                insAct = db.newInsert('xxt_log', {
                    siteid: 1,
                    create_at: 1,
                    method: 'insert',
                    data: '测试数据'
                })
            })
            test("sql", () => {
                expect(insAct.sql).toBe(`insert into xxt_log(siteid,create_at,method,data) values('1','1','insert','测试数据')`)
            })
            test("execute", () => {
                return insAct.exec({ isAutoIncId: true }).then(autoIncId => {
                    expect(autoIncId).toBeGreaterThan(0)
                })
            })
        })
        describe("#Delete", function() {
            let delAct
            beforeAll(() => {
                delAct = db.newDelete('xxt_log')
                delAct.where.fieldMatch('siteid', '=', 1)
            })
            test("sql", () => {
                expect(delAct.sql).toBe(`delete from xxt_log where siteid='1'`)
            })
            test("execute", () => {
                return delAct.exec().then(result => {
                    expect(result).toBeGreaterThanOrEqual(1)
                })
            })
        })
        describe("#Update", function() {
            let updAct
            beforeAll(() => {
                updAct = db.newUpdate('xxt_log')
                updAct.where.fieldMatch('siteid', '=', 1)
            })
            test("sql", () => {
                updAct.data.data = '更新测试数据'
                expect(updAct.sql).toBe(`update xxt_log set data='更新测试数据' where siteid='1'`)
            })
            test("execute", () => {
                return updAct.exec().then(result => {
                    expect(result).toBe(0)
                })
            })
        })
        afterAll(done => {
            db.end(() => {
                require("../../tms/db").Db.closePool(done)
            })
        })
    })
})