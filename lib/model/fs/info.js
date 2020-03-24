const _ = require('lodash')
const FsContext = require('../../fs').Context
/**
 * 在mongodb中保存文件信息
 */
class MongodbInfo {
  constructor(mongoClient, database, collection, schemas) {
    this.mongoClient = mongoClient
    this.database = database
    this.collection = collection
    this.schemas = schemas
  }
  /**
   *
   * @param {*} path
   * @param {*} info
   */
  async set(path, info) {
    const cl = this.mongoClient.db(this.database).collection(this.collection)
    const beforeInfo = await cl.find({ path }).toArray()
    if (beforeInfo.length <= 1) {
      const updatedInfo = _.omit(info, ['_id'])
      return cl
        .updateOne({ path }, { $set: updatedInfo }, { upsert: true })
        .then(() => info)
    } else {
      throw new Error(`数据错误，文件[${path}]有条信息数据`)
    }
  }
  /*
   * @param {string} path
   */
  async get(path) {
    const client = this.mongoClient
    const cl = client.db(this.database).collection(this.collection)
    const info = await cl.findOne({ path })

    return info
  }
}

class Info {
  constructor(handler) {
    this.handler = handler
  }
  get schemas() {
    return this.handler.schemas
  }
  async set(path, info) {
    return await this.handler.set(path, info)
  }
  async get(path) {
    return await this.handler.get(path)
  }
}
Info.init = (function() {
  let _instance

  return async function() {
    if (_instance) return _instance

    const fsContext = await FsContext.ins()

    const mongo = new MongodbInfo(
      fsContext.mongoClient,
      fsContext.database,
      fsContext.collection,
      fsContext.schemas
    )
    // eslint-disable-next-line require-atomic-updates
    _instance = new Info(mongo)

    return _instance
  }
})()

Info.ins = Info.init

module.exports = { Info }
