describe("#model", function() {
    describe("#model.js", function() {
        const { DbModel, Db } = require('../../../lib/model')
        const db = new Db({ debug: true })
        class MockDbModel extends DbModel {
            constructor() {
                super('test_table', { db, debug: true })
            }
        }
        it("select()", () => {
            let moMock = new MockDbModel()
            let sqlWhere = [
                ['fieldMatch', 'id', '=', 1]
            ]
            return moMock.select('id,field1', sqlWhere).then(() => {
                expect(moMock.execSqlStack).toHaveLength(1)
                expect(moMock.execSqlStack[0]).toMatch(/^select id,field1 from test_table where id='1'$/i)
            })
        })
        it("model()-通过model方法创建model可以传递数据库实例", () => {
            let moMock = new MockDbModel()
            let moTest = moMock.model('test')
            expect(moTest.db).toBe(moMock.db)
        })
    })
})