import { ResultObjectNotFound } from 'tms-koa'

/**
 * 保存元数据的数据库
 */
const META_ADMIN_DB = process.env.TMS_KOA_META_ADMIN_DB || 'tms_admin'
/**
 * 保存元数据的集合
 */
const META_ADMIN_CL_BUCKET = 'bucket'

function allowAccessBucket(bucket, clientId) {
  if (bucket.creator === clientId) return true

  const { coworkers } = bucket

  if (!Array.isArray(coworkers)) return false

  return coworkers.some((c) => c.id === clientId)
}
/**
 *
 * @param oCtrl
 * @param tmsClient
 */
export default async function (oCtrl, tmsClient) {
  const bucketName = oCtrl.request.query.bucket
  if (!bucketName) return [false, '请求中没有bucket参数']

  if (!oCtrl.mongoClient) return [false, '没有配置mongodb，无法检查bucket']

  const clBucket = oCtrl.mongoClient
    .db(META_ADMIN_DB)
    .collection(META_ADMIN_CL_BUCKET)

  // 检查bucket是否存在
  const bucketObj = await clBucket.findOne({
    name: bucketName,
  })
  if (!bucketObj) {
    return [false, `指定的[bucket=${bucketName}]不存在`]
  }
  // 检查当前用户是否对bucket有权限
  if (!allowAccessBucket(bucketObj, tmsClient.id)) {
    // 检查是否做过授权
    return [false, `没有访问[bucket=${bucketName}]的权限`]
  }

  return [true, bucketObj]
}
