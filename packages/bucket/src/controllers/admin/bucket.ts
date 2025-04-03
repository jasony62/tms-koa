import { ResultData, ResultFault } from 'tms-koa'
import BucketBase from './bucketBase.js'
import { BucketConfig } from '../../config.js'

/** 用于给用户分配存储空间 */
class Bucket extends BucketBase {
  constructor(ctx, client, dbContext, mongoClient, pushContext, fsContext?) {
    super(ctx, client, dbContext, mongoClient, pushContext, fsContext)
  }
  /**
   * 跳过bucket检查
   *
   * @returns
   */
  tmsBucketValidator() {
    return [true]
  }
  /**
   * 执行方法调用前检查
   */
  async tmsBeforeEach() {
    if (!this.client)
      return new ResultFault('只有通过认证的用户才可以执行该操作')
    let result: any = await super.tmsBeforeEach()
    if (true !== result) return result
    return true
  }
  /**
   * @swagger
   *
   * /api/bucket/admin/bucket/create:
   *   post:
   *     tags:
   *       - admin
   *     summary: 新建存储空间
   *     description: 新建存储空间。空间名称不允许重复。
   *     security:
   *       - HeaderTokenAuth: []
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 description: 存储空间名称。
   *                 type: string
   *               title:
   *                 description: 存储空间标题。
   *                 type: string
   *               description:
   *                 description: 存储空间标题。
   *                 type: string
   *             required:
   *               - name
   *           examples:
   *             basic:
   *               summary: 基础功能
   *               value: {"name": "bucket01", "title": "空间01", "description": "空间01说明"}
   *     responses:
   *       '200':
   *         description: result为创建的空间
   *         content:
   *           application/json:
   *             schema:
   *               "$ref": "#/components/schemas/ResponseData"
   */
  async create() {
    let info = this.request.body

    const cl = this.clBucket

    // 查询是否存在同名存储空间
    let buckets = await cl.find({ name: info.name }).toArray()
    if (buckets.length > 0) {
      return new ResultFault('已存在同名存储空间')
    }

    info.creator = this.client.id

    return cl.insertOne(info).then((result) => {
      info._id = result.insertedId
      return new ResultData(info)
    })
  }
  /**
   * @swagger
   *
   * /api/admin/bucket/update:
   *   post:
   *     tags:
   *       - admin
   *     summary: 更新存储空间
   *     description: 更新存储空间。空间名称不允许重复。
   *     security:
   *       - HeaderTokenAuth: []
   *     parameters:
   *       - $ref: '#/components/parameters/bucket'
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               title:
   *                 description: 存储空间标题。
   *                 type: string
   *               description:
   *                 description: 存储空间标题。
   *                 type: string
   *           examples:
   *             basic:
   *               summary: 基础功能
   *               value: {"title": "空间01", "description": "空间01说明"}
   *     responses:
   *       '200':
   *         description: result为更新后的空间
   *         content:
   *           application/json:
   *             schema:
   *               "$ref": "#/components/schemas/ResponseData"
   */
  async update() {
    const bucketName = this.request.query.bucket
    if (!bucketName) return new ResultFault(`没有指定要更新的bucket`)

    let info = this.request.body
    let { _id, name, ...updatedInfo } = info

    const bucketInfo = await this.clBucket.findOne({ name: bucketName })
    if (!bucketInfo)
      return new ResultFault(`指定的[bucket=${bucketName}]不存在`)

    if (this.client.id !== bucketInfo.creator)
      return new ResultFault('没有权限')

    return this.clBucket
      .updateOne({ name: bucketName }, { $set: updatedInfo })
      .then((res) => {
        return new ResultData(info)
      })
  }
  /**
   * @swagger
   *
   * /api/admin/bucket/remove:
   *   get:
   *     tags:
   *       - admin
   *     summary: 删除存储空间
   *     security:
   *       - HeaderTokenAuth: []
   *     parameters:
   *       - $ref: '#/components/parameters/bucket'
   *     responses:
   *       '200':
   *         description: result为？？？
   *         content:
   *           application/json:
   *             schema:
   *               "$ref": "#/components/schemas/ResponseData"
   */
  async remove() {
    const { bucket: bucketName } = this.request.query
    if (!bucketName) return new ResultFault(`没有指定要删除的bucket`)

    const bucketInfo = await this.clBucket.findOne({ name: bucketName })
    if (!bucketInfo)
      return new ResultFault(`指定的[bucket=${bucketName}]不存在`)

    if (this.client.id !== bucketInfo.creator)
      return new ResultFault('支持允许创建人删除bucket')

    return this.clBucket
      .deleteOne({ name: bucketName, creator: this.client.id })
      .then((result) => new ResultData(result.result))
  }
  /**
   * @swagger
   *
   * /api/admin/bucket/list:
   *   get:
   *     tags:
   *       - admin
   *     summary: 当前用户创建的存储空间
   *     security:
   *       - HeaderTokenAuth: []
   *     responses:
   *       '200':
   *         description: result为存储空间数组
   *         content:
   *           application/json:
   *             schema:
   *               "$ref": "#/components/schemas/ResponseDataArray"
   */
  async list() {
    const tmsBuckets = await this.clBucket
      .find({
        $or: [{ creator: this.client.id }, { 'coworkers.id': this.client.id }],
      })
      .toArray()

    return new ResultData(tmsBuckets)
  }
  /**
   * 返回bucket扩展属性定义
   *
   * @returns
   */
  async schemas() {
    if (BucketConfig.disabled !== true) {
      const { bucket } = BucketConfig
      if (bucket && typeof bucket === 'object') {
        const { schemas, schemasRootName } = bucket
        if (
          schemasRootName &&
          typeof schemasRootName === 'string' &&
          Object.keys(schemas).length
        ) {
          return new ResultData({ schemas, schemasRootName })
        }
      }
    }

    return new ResultFault('没有设置扩展属性', 40420)
  }
}

export default Bucket
