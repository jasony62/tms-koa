import { Ctrl, ResultFault } from 'tms-koa'
import {
  META_ADMIN_DB,
  META_CL_BUCKET,
  META_CL_BUCKET_COWORKER,
} from '../../const.js'

/**
 * Base class for bucket operations
 */
class BucketBase extends Ctrl {
  /**
   * 保存空间数据的集合
   */
  protected _clBucket
  /**
   * 保存协作人数据的集合
   */
  protected _clCoworker

  /**
   * Constructor for BucketBase
   * @param ctx - Context object
   * @param client - Client object
   * @param dbContext - Database context
   * @param mongoClient - MongoDB client
   * @param pushContext - Push context
   * @param fsContext - File system context
   */
  constructor(ctx, client, dbContext, mongoClient, pushContext, fsContext?) {
    super(ctx, client, dbContext, mongoClient, pushContext, fsContext)
  }

  /**
   * Method to perform pre-execution checks
   * @returns True if checks pass, ResultFault if checks fail
   */
  async tmsBeforeEach(): Promise<true | ResultFault> {
    return true
  }

  /**
   * Getter for the bucket collection
   * @returns MongoDB collection for buckets
   */
  get clBucket() {
    if (!this._clBucket) {
      this._clBucket = this.mongoClient
        .db(META_ADMIN_DB)
        .collection(META_CL_BUCKET)
    }
    return this._clBucket
  }

  /**
   * Getter for the coworker collection
   * @returns MongoDB collection for coworkers
   */
  get clCoworker() {
    if (!this._clCoworker) {
      this._clCoworker = this.mongoClient
        .db(META_ADMIN_DB)
        .collection(META_CL_BUCKET_COWORKER)
    }
    return this._clCoworker
  }
}

export default BucketBase
