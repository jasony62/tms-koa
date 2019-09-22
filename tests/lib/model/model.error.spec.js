const { DbModel, DbContext } = require('../../../lib/model')
class FakeDbModel extends DbModel {
    constructor({ db, debug }) {
        super('fake_table', { db, debug })
    }
}

describe('#model-模型层错误', function() {
    let dmFake
    beforeAll(() => {
        dmFake = FakeDbModel.create({})
    })
    it('接收数据库错误-insert', () => {
        return dmFake.insert({ id: 1 })
            .catch(err => {
                expect(err).toMatch(/^执行SQL语句失败\(Table '.*\.fake_table' doesn't exist\)$/)
            })
    })
    it('接收数据库错误-updateById', () => {
        return dmFake.updateById(1, { name: 'fake' })
            .catch(err => {
                expect(err).toMatch(/^执行SQL语句失败\(Table '.*\.fake_table' doesn't exist\)$/)
            })
    })
    it('接收数据库错误-selectOne', () => {
        return dmFake.selectOne('id', [
            ['fieldMatch', 'id', '=', 1]
        ]).catch(err => {
            expect(err).toMatch(/^执行SQL语句失败\(Table '.*\.fake_table' doesn't exist\)$/)
        })
    })
    afterAll(done => {
        dmFake.end(() => {
            DbContext.closePool(done)
        })
    })
})