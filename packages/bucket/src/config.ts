import { loadConfig } from 'tms-koa'

const BucketConfig = await loadConfig('bucket', {})

export { BucketConfig }
