const { BaseCtrl } = require('./base')
const { ResultData } = require('../../response')
const { Info } = require('../../model/fs/info')

/**
 * 文件管理控制器
 */
class ManageCtrl extends BaseCtrl {
  constructor(...args) {
    super(...args)
  }

  async list() {
    const mlInfo = await Info.ins()
    const client = mlInfo.handler.mongoClient
    const cl = client.db('upload').collection('files')

    const { batch } = this.request.query
    const [page, size] = batch.split(',', 2)
    const skip = (parseInt(page) - 1) * parseInt(size)
    const limit = parseInt(size)

    const result = {}

    result.files = await cl
      .find({})
      .skip(skip)
      .limit(limit)
      .toArray()
      .then(docs => docs)

    result.total = await cl.find({}).count()

    return new ResultData(result)
  }
}

module.exports = { ManageCtrl, ResultData }
