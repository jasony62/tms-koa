describe('#model', function() {
  describe('#model.js', function() {
    const { DbModel } = require('@/lib/model')
    class MockDbModel extends DbModel {
      constructor({ db, debug }) {
        super('test_table', { db, debug })
      }
    }
    it('select()', () => {
      let dmMock = MockDbModel.create({ debug: true })
      let sqlWhere = [['fieldMatch', 'id', '=', 1]]
      return dmMock.select('id,field1', sqlWhere).then(() => {
        expect(dmMock.execSqlStack).toHaveLength(1)
        expect(dmMock.execSqlStack[0]).toMatch(/^select id,field1 from test_table where `id` = 1$/i)
      })
    })
    it('model()-通过model方法创建model可以传递数据库实例', () => {
      let dmMock = MockDbModel.create({ debug: true })
      let moTest = dmMock.model('template')
      expect(moTest.db).toBe(dmMock.db)
    })
  })
})
