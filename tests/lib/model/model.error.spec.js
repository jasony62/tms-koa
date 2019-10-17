const log4js = require('log4js')
const logger = log4js.getLogger()
logger.level = 'info'

const { DbContext } = require('tms-db')
const { DbModel } = require('@/lib/model')
class FakeDbModel extends DbModel {
  constructor({ db, debug }) {
    super('fake_table', { db, debug })
  }
}

describe('#model-模型层错误', function() {
  let dmFake
  beforeAll(async () => {
    let dbConfig = require('@/config/db')
    await DbContext.init(dbConfig)
    let ctx = new DbContext()
    dmFake = FakeDbModel.create({ db: ctx.mysql })
  })
  it('接收数据库错误-insert-表名错误', () => {
    return dmFake.insert({ id: 1 }).catch(err => {
      expect(err).toMatch(/^执行SQL语句失败\(Table '.*\.fake_table' doesn't exist\)$/)
    })
  })
  it('接收数据库错误-updateById-表名错误', () => {
    return dmFake.updateById(1, { name: 'fake' }).catch(err => {
      expect(err).toMatch(/^执行SQL语句失败\(Table '.*\.fake_table' doesn't exist\)$/)
    })
  })
  it('接收数据库错误-selectOne-表名错误', () => {
    return dmFake.selectOne('id', [['fieldMatch', 'id', '=', 1]]).catch(err => {
      expect(err).toMatch(/^执行SQL语句失败\(Table '.*\.fake_table' doesn't exist\)$/)
    })
  })
  it('接收数据库错误-selectOne-列名错误', () => {
    class InfoSchemaDbModel extends DbModel {
      constructor({ db, debug }) {
        super('information_schema.tables', { db, debug })
      }
    }
    let dmInfoSchema = InfoSchemaDbModel.create({ db: dmFake.db })
    return dmInfoSchema.selectOne('id', [['fieldMatch', 'id', '=', 1]]).catch(err => {
      console.log('err', err)
      expect(err).toMatch(/^执行SQL语句失败\(Unknown column 'id' in 'field list'\)$/)
    })
  })
  afterAll(done => {
    dmFake.end(() => {
      DbContext.close(done)
    })
  })
})
