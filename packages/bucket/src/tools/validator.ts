import {
  META_ADMIN_DB,
  META_CL_BUCKET,
  META_CL_BUCKET_COWORKER,
} from '../const.js'

function allowAccessBucket(oCtrl, bucket, clientId) {
  if (bucket.creator === clientId) return true

  const clCoworker = oCtrl.mongoClient
    .db(META_ADMIN_DB)
    .collection(META_CL_BUCKET_COWORKER)

  const coworker = clCoworker.findOne({
    bucket,
    'coworker.id': clientId,
    acceptAt: { $exists: true },
    removeAt: { $exists: false },
  })

  return !!coworker
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
    .collection(META_CL_BUCKET)

  // 检查bucket是否存在
  const bucketObj = await clBucket.findOne({
    name: bucketName,
  })
  if (!bucketObj) {
    return [false, `指定的[bucket=${bucketName}]不存在`]
  }
  // 检查当前用户是否对bucket有权限
  if (!allowAccessBucket(oCtrl, bucketObj, tmsClient.id)) {
    // 检查是否做过授权
    return [false, `没有访问[bucket=${bucketName}]的权限`]
  }

  return [true, bucketObj]
}
