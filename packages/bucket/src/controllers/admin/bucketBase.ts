import { Ctrl, ResultFault } from 'tms-koa'

/**
 * 保存元数据的数据库
 */
const META_ADMIN_DB = process.env.TMS_KOA_META_ADMIN_DB || 'tms_admin'
/**
 * 保存元数据的集合
 */
const META_CL_BUCKET = 'bucket'

class BucketBase extends Ctrl {
  /**
   * 保存bucket数据的集合
   */
  protected clBucket

  constructor(ctx, client, dbContext, mongoClient, pushContext, fsContext?) {
    super(ctx, client, dbContext, mongoClient, pushContext, fsContext)
  }
  async tmsBeforeEach(): Promise<true | ResultFault> {
    const client = this.mongoClient
    const clBucket = client.db(META_ADMIN_DB).collection(META_CL_BUCKET)
    this.clBucket = clBucket

    return true
  }
}

export default BucketBase
