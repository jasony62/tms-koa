/**
 * 文件服务域，代表一组文件服务功能配置
 */
export type TmsFsDomain = {
  name: string
  customName?: boolean
  thumbnail?: {
    dir: string
    width: number
    height: number
  }
  mongoClient?: any
  database?: string
  collection?: string
  schemas?: any
  schemasRootName?: string
  aclValidator?: any // function
}
/**
 *
 */
export type TmsBucket = {
  name: string
  [k: string]: any
}
/**
 * 目录对象
 */
export type TmsDir = {
  name: string
  path: string
  publicUrl?: string
  birthtime?: number
  sub?: { files: number; dirs: number }
}
/**
 * 文件对象
 */
export type TmsFile = {
  path: string
  name: string
  size: number
  birthtime?: number
  mtime: number
  publicUrl?: string
  thumbUrl?: string
}
