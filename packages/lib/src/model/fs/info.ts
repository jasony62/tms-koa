import _ from 'lodash'
/**
 * 在mongodb中保存文件信息
 */
class MongodbInfo {
  domain
  mongoClient
  database
  collection
  constructor(domain) {
    let { mongoClient, database, collection } = domain
    this.domain = domain
    this.mongoClient = mongoClient
    this.database = database
    this.collection = collection
  }
  /**
   * 更新文件关联的业务信息
   *
   * @param {*} path
   * @param {*} info
   */
  async set(path: string, info: any) {
    let query: any = { domain: this.domain.name, path }
    if (info.bucket) query.bucket = info.bucket

    const cl = this.mongoClient.db(this.database).collection(this.collection)
    const beforeInfo = await cl.find(query).toArray()
    if (beforeInfo.length <= 1) {
      const updatedInfo = _.omit(info, ['_id', 'domain', 'bucket'])
      return cl
        .updateOne(query, { $set: updatedInfo }, { upsert: true })
        .then(() => info)
    } else {
      throw new Error(`数据错误，文件[${path}]有多条信息数据`)
    }
  }
  /*
   * @param {string} path
   */
  async get(path: string) {
    const client = this.mongoClient
    const cl = client.db(this.database).collection(this.collection)
    const info = await cl.findOne({ path })

    return info
  }
  /**
   * 删除文件信息
   *
   * @param bucket
   * @param path
   *
   * @returns
   */
  async remove(bucket: string, path: string) {
    const client = this.mongoClient
    const cl = client.db(this.database).collection(this.collection)

    let query: any = { domain: this.domain.name, path }
    if (bucket) query.bucket = bucket
    const { deletedCount } = await cl.deleteOne(query)
    return deletedCount === 1
  }
  /**
   *
   * @param {*} query
   * @param {*} skip
   * @param {*} limit
   */
  async list(query, skip: number, limit: number) {
    const client = this.mongoClient
    const cl = client.db(this.database).collection(this.collection)

    const result: any = {}
    result.files = await cl
      .find(query)
      .skip(skip)
      .limit(limit)
      .toArray()
      .then((docs) => {
        // 需要把path中domain去掉
        docs.forEach((doc) => {
          let { domain, bucket } = doc
          if (typeof domain === 'string' && doc.path) {
            let prefix = domain
            if (typeof bucket === 'string') prefix += `/${bucket}`
            doc.publicUrl = `${prefix}/${doc.path}`
            if (this.domain.thumbnail) {
              let thumbPrefix = `${domain}/${this.domain.thumbnail.dir}`
              if (typeof bucket === 'string') thumbPrefix += `/${bucket}`
              doc.thumbUrl = `${thumbPrefix}/${doc.path}`
            }
          }
        })
        return docs
      })

    result.total = await cl.find(query).count()

    return result
  }
}
/**
 * 文件对象扩展信息管理
 */
export class Info {
  domain
  handler
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
  async remove(bucket: string, path: string) {
    return await this.handler.remove(bucket, path)
  }
  async list(query, skip, limit) {
    if (!query) query = {}
    query.domain = this.domain.name
    return await this.handler.list(query, skip, limit)
  }
  static init = (function () {
    let _instance = new Map()

    return async function (domain) {
      if (_instance.has(domain.name)) return _instance.get(domain.name)

      if (!domain.mongoClient || !domain.database || !domain.collection)
        return false

      const mongo = new MongodbInfo(domain)
      const domainInfo = new Info(domain, mongo)
      _instance.set(domain.name, domainInfo)

      return domainInfo
    }
  })()
  static ins = Info.init
}
