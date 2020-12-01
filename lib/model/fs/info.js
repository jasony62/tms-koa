const _ = require('lodash')
/**
 * 在mongodb中保存文件信息
 */
class MongodbInfo {
  constructor(mongoClient, database, collection) {
    this.mongoClient = mongoClient
    this.database = database
    this.collection = collection
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
  /**
   *
   * @param {*} query
   * @param {*} skip
   * @param {*} limit
   */
  async list(query, skip, limit) {
    const client = this.mongoClient
    const cl = client.db(this.database).collection(this.collection)

    const result = {}
    result.files = await cl
      .find(query)
      .skip(skip)
      .limit(limit)
      .toArray()
      .then((docs) => docs)

    result.total = await cl.find(query).count()

    return result
  }
}

class Info {
  constructor(domain, handler) {
    this.domain = domain
    this.handler = handler
  }
  get schemas() {
    return this.domain.schemas
  }
  async set(path, info) {
    info.domain = this.domain.name
    return await this.handler.set(path, info)
  }
  async get(path) {
    return await this.handler.get(path)
  }
  async list(query, skip, limit) {
    if (!query) query = {}
    query.domain = this.domain.name
    return await this.handler.list(query, skip, limit)
  }
}
Info.init = (function () {
  let _instance = new Map()

  return async function (domain) {
    if (_instance.has(domain.name)) return _instance.get(domain.name)

    if (
      !domain.mongoClient ||
      !domain.database ||
      !domain.collection ||
      !domain.schemas
    )
      return false

    const mongo = new MongodbInfo(
      domain.mongoClient,
      domain.database,
      domain.collection,
      domain.schemas
    )
    const domainInfo = new Info(domain, mongo)
    _instance.set(domain.name, domainInfo)

    return domainInfo
  }
})()

Info.ins = Info.init

module.exports = { Info }
