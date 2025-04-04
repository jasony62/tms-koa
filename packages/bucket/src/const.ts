/**
 * 保存元数据的数据库
 */
const META_ADMIN_DB = process.env.TMS_KOA_META_ADMIN_DB || 'tms_admin'
/**
 * 保存空间数据的集合
 */
const META_CL_BUCKET = 'bucket'
/**
 * 保存空间协作人数据的集合
 */
const META_CL_BUCKET_COWORKER = 'bucket_coworker'
/**
 * 邀请过期时间
 */
const COWORKER_INVITE_EXPIRE_MS =
  parseInt(process.env.TMS_KOA_BUCKET_COWORKER_INVITE_EXPIRE_MS) ||
  60 * 30 * 1000

export {
  META_ADMIN_DB,
  META_CL_BUCKET,
  META_CL_BUCKET_COWORKER,
  COWORKER_INVITE_EXPIRE_MS,
}
