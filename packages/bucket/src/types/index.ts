/**
 * 空间
 */
export interface IBucket {
  name: string
  title: string
  description: string
  creator: string
  createAt: Date
}
/**
 * 空间协作人
 */
export interface IBucketCoworker {
  inviter: string
  bucket: string
  code: string
  createAt: Date
  expireAt?: Date
  removeAt?: Date
  coworker: { id?: string; nickname: string }
}
