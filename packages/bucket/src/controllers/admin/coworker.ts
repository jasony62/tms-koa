import { ResultData, ResultFault } from 'tms-koa'
import { nanoid } from 'nanoid'
import mongodb from 'mongodb'
import BucketBase from './bucketBase.js'
import { COWORKER_INVITE_EXPIRE_MS } from '../../const.js'

const ObjectId = mongodb.ObjectId

/** 空间用户管理控制器 */
class Coworker extends BucketBase {
  /**
   * 跳过bucket检查
   *
   * @returns
   */
  tmsBucketValidator() {
    let { bucket } = this.request.query
    return [true, { name: bucket }]
  }
  /**
   * 执行方法调用前检查
   */
  async tmsBeforeEach(): Promise<true | ResultFault> {
    const { url } = this.request
    if (!this.client)
      return new ResultFault('只有通过认证的用户才可以执行该操作')

    // 接受邀请api不进行其它检查
    if (url.split('?')[0].split('/').pop() === 'accept') return true

    let result: any = await super.tmsBeforeEach()
    if (true !== result) return result

    return true
  }
  /**
   * 返回邀请码
   *
   * @swagger
   *
   * /api/admin/bucket/coworker/invite:
   *   post:
   *     tags:
   *       - admin
   *     summary: 创建空间邀请
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
   *               nickname:
   *                 description: 被邀请用户的昵称。
   *                 type: string
   *     responses:
   *       '200':
   *         description: result为4位字符的邀请码
   *         content:
   *           application/json:
   *             schema:
   *               "$ref": "#/components/schemas/ResponseData"
   */
  async invite() {
    if (!this.bucketObj?.name) return new ResultFault('没有指定邀请的空间')

    const { nickname } = this.request.body
    if (!nickname) return new ResultFault('没有指定被邀请用户的昵称')

    const targetBucket = await this.clBucket.findOne({
      name: this.bucketObj.name,
      removeAt: { $exists: false },
    })
    if (!targetBucket)
      return new ResultFault(`指定的空间[${this.bucketObj.name}]不存在`)

    if (this.client.id !== targetBucket.creator)
      return new ResultFault(`不是空间创建人，没有邀请加入空间的操作权限`)

    /**
     * 检查是否已经是协作人
     */
    const coworker = await this.clCoworker.findOne({
      bucket: this.bucketObj.name,
      'coworker.nickname': nickname,
      acceptAt: { $exists: true },
      removeAt: { $exists: false },
    })
    if (coworker)
      return new ResultFault(`用户[${nickname}]已经是协作人，不用重复邀请`)
    /**
     * 检查是否存在邀请，若存在，更新过期时间
     */
    const invitation = await this.clCoworker.findOne({
      bucket: this.bucketObj.name,
      'coworker.nickname': nickname,
      acceptAt: { $exists: false },
      removeAt: { $exists: false },
    })
    if (invitation) {
      // 重新发出邀请，更新邀请过期时间
      await this.clCoworker.updateOne(
        { _id: new ObjectId(invitation._id) },
        { $set: { expireAt: new Date(Date.now() + COWORKER_INVITE_EXPIRE_MS) } }
      )
      return new ResultData(invitation.code)
    }

    /**
     * 生成邀请
     */
    let tries = 0
    let existInvitation
    let code = nanoid(4)
    while (tries <= 2) {
      existInvitation = await this.clCoworker.findOne({
        bucket: this.bucketObj.name,
        code,
        acceptAt: { $exists: false },
        removeAt: { $exists: false },
      })
      if (!existInvitation) break
      code = nanoid(4)
      tries++
    }

    if (existInvitation) return new ResultFault('无法生成有效的邀请码')

    const createAt = new Date()
    const expireAt = new Date(createAt.getTime() + COWORKER_INVITE_EXPIRE_MS) // 邀请过期时间
    const newCoworker = {
      inviter: this.client.id,
      bucket: this.bucketObj.name,
      code,
      createAt,
      expireAt,
      coworker: { nickname },
    }

    return this.clCoworker
      .insertOne(newCoworker)
      .then(() => new ResultData(code))
  }
  /**
   * 获得邀请的所有协作人
   *
   * @returns
   */
  async list() {
    if (!this.bucketObj?.name) return new ResultFault('没有指定邀请的空间')

    const coworkers = await this.clCoworker
      .find({
        inviter: this.client.id,
        bucket: this.bucketObj.name,
        removeAt: { $exists: false },
      })
      .toArray()

    return new ResultData(coworkers)
  }
  /**
   * @swagger
   *
   * /api/admin/bucket/coworker/accept:
   *   post:
   *     tags:
   *       - admin
   *     summary: 接受空间邀请
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
   *               code:
   *                 description: 邀请码。
   *                 type: string
   *               nickname:
   *                 description: 被邀请用户的昵称。
   *                 type: string
   *             required:
   *               - code
   *               - nickname
   *     responses:
   *       '200':
   *         description: result为ok
   *         content:
   *           application/json:
   *             schema:
   *               "$ref": "#/components/schemas/ResponseData"
   */
  async accept() {
    const { bucket } = this.request.query
    if (!bucket) return new ResultFault('没有指定邀请的空间')

    const { code, nickname } = this.request.body
    if (!code || !nickname) return new ResultFault('没有提供有效参数')

    // @TODO 如何检查nickname是否与当前用户匹配？
    // if (nickname !== this.client?.id) {
    //   console.warn(
    //     `[tms-koa-bucket][coworker:accept] 用户信息不匹配 nickname=${nickname}, client.id=${this.client.id}`
    //   )
    //   return new ResultFault('用户信息不匹配')
    // }

    /**
     * 有匹配的邀请？
     */
    const invitation = await this.clCoworker.findOne({
      bucket,
      code,
      'coworker.nickname': nickname,
      expireAt: { $gt: new Date() },
      removeAt: { $exists: false },
    })

    if (!invitation)
      return new ResultFault(
        '没有匹配的邀请，请确认邀请码、昵称是否正确，邀请是否已过期'
      )

    if (invitation.acceptAt)
      return new ResultFault('邀请码已经使用，不允许重复使用')

    return this.clCoworker
      .updateOne(
        {
          _id: new ObjectId(invitation._id),
        },
        {
          $set: { acceptAt: new Date(), 'coworker.id': this.client.id },
          $unset: { expireAt: 1 },
        }
      )
      .then(() => new ResultData('ok'))
  }
  /**
   * @swagger
   *
   * /api/admin/bucket/coworker/remove:
   *   get:
   *     tags:
   *       - admin
   *     summary: 删除授权访问用户
   *     security:
   *       - HeaderTokenAuth: []
   *     parameters:
   *       - $ref: '#/components/parameters/bucket'
   *       - name: coworker
   *         description: 被邀请用户的id
   *         in: query
   *         schema:
   *           type: string
   *         required: true
   *     responses:
   *       '200':
   *         description: result为ok
   *         content:
   *           application/json:
   *             schema:
   *               "$ref": "#/components/schemas/ResponseData"
   */
  async remove() {
    if (!this.bucketObj?.name) return new ResultFault('没有指定邀请的空间')

    const { nickname } = this.request.query

    const existCoworker = await this.clCoworker.findOne({
      bucket: this.bucketObj.name,
      'coworker.nickname': nickname,
      removeAt: { $exists: false },
    })

    if (!existCoworker)
      return new ResultFault(`指定的协作人[${nickname}]不存在`)

    return this.clCoworker
      .updateOne(
        {
          _id: new ObjectId(existCoworker._id),
        },
        {
          $set: { removeAt: new Date() },
        }
      )
      .then(() => new ResultData('ok'))
  }
}

export default Coworker
