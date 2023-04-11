import path from 'path'
import * as _ from 'lodash'

import type { File } from 'formidable'
import type { TmsDir, TmsFile } from '../../types/fs'

const LFS_APPROOTDIR = Symbol('lfs_appRootDir')
const LFS_PREFIX = Symbol('lfs_prefix')
const LFS_DOMAIN = Symbol('lfs_domain')
const LFS_BUCKET = Symbol('lfs_bucket')
/**
 * minio作为存储服务
 */
export class MinioFS {
  tmsContext
  minioClient
  /**
   * @param {object} TmsContext 文件服务定义
   * @param {object|string} domain
   * @param {string} bucket
   */
  constructor(TmsContext, domain, bucket = '') {
    if (!domain) Error('没有提供文件服务[domain]参数')
    let domainName
    if (typeof domain === 'string') {
      domainName = domain
    } else if (typeof domain === 'object') {
      domainName = domain.name
      if (typeof domainName !== 'string' || domainName.length === 0)
        throw Error('没有提供文件服务[domain.name]参数')
    } else {
      if (!domain) Error('文件服务[domain]参数类型错误')
    }

    const fsContext = TmsContext.FsContext.insSync()
    domain = fsContext.getDomain(domainName)
    if (!domain) throw Error(`指定的文件服务[domain=${domainName}]不存在`)

    const appRootDir = fsContext.rootDir

    domainName = domainName.replace(/^\/|\/$/g, '')

    // rootDir忽略，domainName作为minio的bucket
    // let rootDir = `${appRootDir}/${domainName}`

    let prefix = domainName
    if (bucket) {
      bucket = bucket.replace(/^\/|\/$/g, '')
      prefix = `/${bucket}`
    }

    this.tmsContext = TmsContext
    this[LFS_APPROOTDIR] = appRootDir
    this[LFS_PREFIX] = prefix
    this[LFS_DOMAIN] = domain
    this[LFS_BUCKET] = bucket

    this.minioClient = fsContext.minioClient
  }

  get appRootDir() {
    return this[LFS_APPROOTDIR]
  }
  get prefix() {
    return this[LFS_PREFIX]
  }
  get domain() {
    return this[LFS_DOMAIN]
  }
  get bucket() {
    return this[LFS_BUCKET]
  }
  get thumbDir() {
    return ''
  }
  get thumbWidth() {
    return 0
  }
  get thumbHeight() {
    return 0
  }
  /**
   * 包含根路径的文件路径，从domain开始。
   *
   * @param {string} filename
   * @param {boolean} isRelative
   */
  pathWithPrefix(filename, isRelative = true) {
    let fullpath = isRelative ? path.join(this.prefix, filename) : filename

    return fullpath
  }
  /**
   * 文件的存储路径。添加bucket名
   *
   * @param filename
   * @param isRelative
   * @returns
   */
  pathWithBucket(filename, isRelative = true) {
    if (this.bucket) {
      let storepath = isRelative ? path.join(this.bucket, filename) : filename
      return storepath
    }
    return filename
  }
  /**
   * 去掉文件路径中的bucket部分
   * @param filepath
   */
  pathCleanBucket(filepath: string) {
    if (this.bucket) {
      return filepath.replace(`${this.bucket}/`, '')
    }
    return filepath
  }
  /**
   * 返回指定目录下的内容
   *
   * @param {string} dir
   * @param {number} depth 获取深度。目前只支持取下面1级
   */
  list(dir = '', depth = 0) {
    return new Promise<{ files: TmsFile[]; dirs: TmsDir[] }>(
      (resolve, reject) => {
        let stream = this.minioClient.listObjectsV2(this.domain.name, `${dir}/`)
        let files: TmsFile[] = [],
          dirs: TmsDir[] = []
        stream.on('data', async (obj) => {
          if (typeof obj?.name === 'string') {
            // 文件
            let { name: path, lastModified, size } = obj
            let namesegs = path.split('/')
            let name = namesegs[namesegs.length - 1]
            files.push({
              name,
              size,
              mtime: lastModified,
              path: this.pathCleanBucket(path),
              publicUrl: `${this.prefix}/${path}`,
            })
          } else if (typeof obj?.prefix === 'string') {
            // 目录
            let { prefix } = obj // 以反斜杠作为结尾
            let dirfullname = prefix.replace(/\/$/, '') // 去掉结尾的反斜杠
            let dirsegs = dirfullname.split('/')
            let tmsDir: TmsDir = {
              name: dirsegs[dirsegs.length - 1],
              path: dirfullname,
              publicUrl: `${this.prefix}/${dirfullname}`,
            }
            dirs.push(tmsDir)
          }
        })
        stream.on('end', async () => {
          if (depth > 0 && dirs.length) {
            for (let tmsDir of dirs) {
              // 目前只支持取下面1级
              tmsDir.sub = { dirs: 0, files: 0 }
              let subs = await this.list(`${dir}/${tmsDir.name}`, 0)
              tmsDir.sub.dirs = subs.dirs.length
              tmsDir.sub.files = subs.files.length
            }
          }
          resolve({ files, dirs })
        })
        stream.on('error', function (err) {
          console.log(err)
          reject(err)
        })
      }
    )
  }
  /**
   *
   * @param {*} filename
   * @param {*} isRelative
   */
  existsSync(filename, isRelative = true) {
    // // 文件的完整路径
    // let fullpath = this.fullpath(filename, isRelative)
    // return fs.existsSync(fullpath)
  }
  /**
   * 写文件，如果已存在覆盖现有文件
   *
   * @param {string} filepath
   * @param {*} content
   * @param {boolean} isRelative
   *
   * @return 返回fullpath
   */
  write(filepath, content, isRelative = true) {
    let storepath = this.pathWithBucket(filepath, isRelative)
    // 文件的完整路径
    return new Promise((resolve, reject) => {
      this.minioClient.putObject(this.domain.name, storepath, content, (e) => {
        if (e) reject(e)
        else resolve(filepath)
      })
    })
  }
  /**
   * 保存通过koa-body上传的文件
   *
   * @param {string} filepath 在domain/bucket/下的路径
   * @param {*} file
   *
   * @return 返回filepath
   */
  writeStream(filepath: string, file: File, isRelative = true) {
    let storepath = this.pathWithBucket(filepath, isRelative)
    let metaData = {
      'Content-Type': file.mimetype ?? 'application/octet-stream',
    }
    // 文件的完整路径
    return new Promise((resolve, reject) => {
      this.minioClient.fPutObject(
        this.domain.name,
        storepath,
        file.filepath,
        metaData,
        (err, etag) => {
          if (err) reject(err.message)
          else resolve(filepath)
        }
      )
    })
  }
  /**
   * 删文件
   *
   * @param {string} filepath
   * @param {*} isRelative
   */
  remove(filepath, isRelative = true) {
    // let storepath = filepath.replace(this.domain.name + '/', '')
    let storepath = this.pathWithBucket(filepath, isRelative)
    return new Promise((resolve) => {
      this.minioClient.removeObject(this.domain.name, storepath, (e) => {
        if (e) return resolve([false, e.message])
        resolve([true])
      })
    })
  }
  /**
   * 新建指定的目录
   * 通过创建临时文件后立刻删除模拟创建目录了
   *
   * @param {*} path 目录的路径
   */
  mkdir(path: string): Promise<[boolean, string?]> {
    let storepath = this.pathWithBucket(path)
    let tmpname = `${storepath}/tmp001` // 临时文件，创建后立刻删除
    return new Promise((resolve) => {
      this.minioClient.putObject(this.domain.name, tmpname, '', (e) => {
        if (e) return resolve([false, e.message])
        this.minioClient.removeObject(this.domain.name, tmpname, (e) => {
          if (e) return resolve([false, e.message])
          resolve([true])
        })
      })
    })
  }
  /**
   * 删除指定的目录
   * 使用forceDelete参数，该参数在sdk文档中未提供，sdk代码中有
   *
   * @param {*} path
   */
  rmdir(path: string): Promise<[boolean, string?]> {
    let storepath = this.pathWithBucket(path)
    return new Promise((resolve) => {
      this.minioClient.removeObject(
        this.domain.name,
        storepath,
        { forceDelete: true },
        (e) => {
          if (e) return [false, e.message]
          resolve([true])
        }
      )
    })
  }
  /**
   * 生成缩略图
   */
  async makeThumb(filepath, isRelative = true) {}
}
