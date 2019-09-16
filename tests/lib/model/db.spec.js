describe("#model", function() {
    describe("#db.js", function() {
        let { Db, DbContext } = require("../../../lib/model/db")
        let ctx, db
        beforeAll(() => {
            return DbContext.getConnection().then(conn => {
                ctx = new DbContext({ conn })
                db = new Db({ ctx })
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
                expect(where.pieces[0]).toBe("`f` = 'a'")
            })
            test("field in(match)", () => {
                where.fieldIn('f', ['a', 'b', 'c'])
                expect(where.pieces[1]).toBe("`f` in('a', 'b', 'c')")
            })
            test("field not in(match)", () => {
                where.fieldNotIn('f', ['a', 'b', 'c'])
                expect(where.pieces[2]).toBe("`f` not in('a', 'b', 'c')")
            })
            test("field between match0 and match1", () => {
                where.fieldBetween('f', [1, 2])
                expect(where.pieces[3]).toBe("`f` between 1 and 2")
            })
            test("field not between match0 and match1", () => {
                where.fieldNotBetween('f', [1, 2])
                expect(where.pieces[4]).toBe("`f` not between 1 and 2")
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
                expect(where.sql).toBe("`f` = 'a' and `f` in('a', 'b', 'c') and `f` not in('a', 'b', 'c') and `f` between 1 and 2 and `f` not between 1 and 2 and exists('select c from t') and (a=1 and b=2) and (a=1 or b=2)")
            })
        })
        describe("#Insert", function() {
            let insAct;
            beforeAll(() => {
                insAct = db.newInsert('tms_transaction', {
                    begin_at: 1000,
                    end_at: 1001,
                    userid: 'anyuserid'
                })
            })
            test("sql", () => {
                expect(insAct.sql).toMatch(/^INSERT INTO tms_transaction\(`begin_at`, `end_at`, `userid`\) VALUES\(1000, 1001, 'anyuserid'\)$/)
            })
            test("execute-获得自增id", () => {
                return insAct.exec({ isAutoIncId: true }).then(autoIncId => {
                    expect(autoIncId).toBeGreaterThan(0)
                })
            })
        })
        describe("#Select", function() {
            let select
            beforeAll(() => {
                select = db.newSelect('tms_transaction', 'id,begin_at,end_at')
                select.where.fieldMatch('userid', '=', 'anyuserid');
            })
            test("sql", () => {
                expect(select.sql).toMatch(/^SELECT id,begin_at,end_at FROM tms_transaction WHERE `userid` = 'anyuserid'$/i)
            })
            test("execute", async () => {
                return select.exec().then(result => {
                    expect(result[0].begin_at).toBe(1000)
                    expect(result[0].end_at).toBe(1001)
                })
            })
        })
        describe("#Update", function() {
            let updAct
            beforeAll(() => {
                updAct = db.newUpdate('tms_transaction')
                updAct.where.fieldMatch('userid', '=', 'anyuserid')
            })
            test("sql", () => {
                updAct.data.end_at = 2001
                updAct.data.userid = 'anotheruserid'
                expect(updAct.sql).toMatch(/^UPDATE tms_transaction SET `end_at` = 2001, `userid` = 'anotheruserid' WHERE `userid` = 'anyuserid'$/i)
            })
            test("execute", () => {
                return updAct.exec().then(result => {
                    expect(result).toBe(1)
                })
            })
        })
        describe("#Delete", function() {
            let delAct
            beforeAll(() => {
                delAct = db.newDelete('tms_transaction')
                delAct.where.fieldMatch('userid', '=', 'anotheruserid')
            })
            test("sql", () => {
                expect(delAct.sql).toMatch(/^DELETE FROM tms_transaction WHERE `userid` = 'anotheruserid'$/i)
            })
            test("execute", () => {
                return delAct.exec().then(result => {
                    expect(result).toBeGreaterThanOrEqual(1)
                })
            })
        })
        afterAll(done => {
            ctx.end(() => {
                DbContext.closePool(done)
            })
        })
    })
})