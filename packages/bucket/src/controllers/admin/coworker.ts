import { ResultData, ResultFault } from 'tms-koa'
import { nanoid } from 'nanoid'
import mongodb from 'mongodb'
import BucketBase from './bucketBase.js'

/**
 * 保存元数据的数据库
 */
const META_ADMIN_DB = process.env.TMS_KOA_META_ADMIN_DB || 'tms_admin'
/**
 * 保存元数据的集合
 */
const META_CL_BUCKET = 'bucket'
/**
 *
 */
const META_CL_INVITE_LOG = 'bucket_invite_log'

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
    if (url.split('?')[0].split('/').pop() === 'accept') return true

    let result: any = await super.tmsBeforeEach()
    if (true !== result) return result

    return true
  }
  /**
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

    /*检查nickname*/
    const clBkt = this.mongoClient.db(META_ADMIN_DB).collection(META_CL_BUCKET)
    const coworkerBucket = await clBkt.findOne({
      name: this.bucketObj.name,
      'coworkers.nickname': nickname,
    })
    const coworkerInfo = await clBkt.findOne({
      name: this.bucketObj.name,
    })
    if (this.client.id !== coworkerInfo.creator)
      return new ResultFault(`没有权限`)
    if (coworkerBucket)
      return new ResultFault(`用户【${nickname}】已经是授权用户，不能重复邀请`)
    const clLog = this.mongoClient
      .db(META_ADMIN_DB)
      .collection(META_CL_INVITE_LOG)

    const inviteLog = await clLog.findOne({
      bucket: this.bucketObj.name,
      nickname,
      acceptAt: { $exists: false },
    })
    if (inviteLog) {
      // 重新发出邀请，更新邀请过期时间
      await clLog.updateOne(
        { _id: new ObjectId(inviteLog._id) },
        { $set: { expireAt: new Date(Date.now() + (3600 * 8 + 1800) * 1000) } }
      )
      return new ResultData(inviteLog.code)
    }

    // 生成数据库系统名
    let tries = 0,
      existInvite
    let code = nanoid(4)
    while (tries <= 2) {
      existInvite = await clLog.findOne({ bucket: this.bucketObj.name, code })
      if (!existInvite) break
      code = nanoid(4)
      tries++
    }
    if (existInvite) return new ResultFault('无法生成有效的邀请码')

    const now = new Date()
    const createAt = new Date(now.getTime() + 3600 * 8 * 1000)
    const expireAt = new Date(createAt.getTime() + 1800 * 1000)

    const invite = {
      inviter: this.client.id,
      bucket: this.bucketObj.name,
      code,
      createAt,
      expireAt,
      nickname,
    }

    return clLog.insertOne(invite).then(() => new ResultData(code))
  }
  /**
   *
   * @returns
   */
  async list() {
    if (!this.bucketObj?.name) return new ResultFault('没有指定邀请的空间')

    const clBkt = this.mongoClient
      .db(META_ADMIN_DB)
      .collection(META_CL_INVITE_LOG)

    const logs = await clBkt
      .find({
        inviter: this.client.id,
        bucket: this.bucketObj.name,
      })
      .toArray()

    return new ResultData(logs)
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

    const clLog = this.mongoClient
      .db(META_ADMIN_DB)
      .collection(META_CL_INVITE_LOG)

    const { code, nickname } = this.request.body
    if (!code || !nickname) return new ResultFault('没有提供有效参数')
    if (nickname !== this.client?.id) {
      console.warn(
        `[tms-koa-bucket][coworker:accept] 用户信息不匹配 nickname=${nickname}, client.id=${this.client.id}`
      )
      return new ResultFault('用户信息不匹配')
    }

    const invite = await clLog.findOne({
      bucket,
      code,
      nickname,
      expireAt: { $gt: new Date() },
    })

    if (!invite)
      return new ResultFault(
        '没有匹配的邀请，请确认邀请码、昵称是否正确，要求是否已过期'
      )

    if (invite.acceptAt)
      return new ResultFault('邀请码已经使用，不允许重复使用')

    // const current = dayjs(new Date(Date.now() + 3600 * 8 * 1000))
    // let accept_time = current.format('YYYY-MM-DD HH:mm:ss')
    let accept_time = new Date(Date.now() + 3600 * 8 * 1000)
    const invitee = this.client.id // 被邀请人
    /*加入bucket授权列表*/
    const clBucket = this.mongoClient
      .db(META_ADMIN_DB)
      .collection(META_CL_BUCKET)
    const coworkerQuery = {
      name: bucket,
      'coworkers.id': invitee,
    }
    const coworkerBucket = await clBucket.findOne(coworkerQuery)
    if (coworkerBucket) {
      await clBucket.updateOne(coworkerQuery, {
        $set: {
          'coworkers.$.nickname': nickname,
          'coworkers.$.change_time': accept_time,
        },
      })
    } else {
      await clBucket.updateOne(
        { name: bucket },
        {
          $push: {
            coworkers: { id: invitee, nickname, accept_time: accept_time },
          },
        }
      )
    }

    return clLog
      .updateOne(
        { _id: new ObjectId(invite._id) },
        { $set: { invitee, acceptAt: accept_time } }
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

    const { coworker } = this.request.query

    const clBkt = this.mongoClient.db(META_ADMIN_DB).collection(META_CL_BUCKET)
    const coworkerBucket = await clBkt.findOne({
      name: this.bucketObj.name,
      'coworkers.id': { $in: [coworker, parseInt(coworker)] },
    })

    if (!coworkerBucket) return new ResultFault('指定的用户不存在')

    return clBkt
      .updateOne(
        {
          _id: new ObjectId(coworkerBucket._id),
        },
        {
          $pull: { coworkers: { id: { $in: [coworker, parseInt(coworker)] } } },
        }
      )
      .then(() => new ResultData('ok'))
  }
}

export default Coworker
