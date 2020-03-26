const { BaseCtrl } = require('./base')
const { ResultData, ResultFault } = require('../../response')
const { Info } = require('../../model/fs/info')

/**
 * 文件管理控制器
 */
class ManageCtrl extends BaseCtrl {
  constructor(...args) {
    super(...args)
  }

  async list() {
    const fsInfo = await Info.ins()
    if (!fsInfo) return new ResultFault('不支持设置文件信息')

    const client = fsInfo.handler.mongoClient
    const cl = client.db(this.domain).collection('files')

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
