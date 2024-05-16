import fs from 'fs-extra'
import path from 'path'
import _ from 'lodash'

import type { TmsDir, TmsFile } from '../../types/fs/index.js'
import type { File } from 'formidable'

/**
 * 本地文件系统
 */
const LFS_APPROOTDIR = Symbol('lfs_appRootDir')
const LFS_PREFIX = Symbol('lfs_prefix')
const LFS_DOMAIN = Symbol('lfs_domain')
const LFS_BUCKET = Symbol('lfs_bucket')
const LFS_THUMB_ROOTDIR = Symbol('lfs_thumb_root')
const LFS_THUMB_PREFIX = Symbol('lfs_thumb_prefix')
const LFS_THUMB_WIDTH = Symbol('lfs_thumb_width')
const LFS_THUMB_HEIGHT = Symbol('lfs_thumb_height')

export class LocalFS {
  tmsContext
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
      throw Error('文件服务[domain]参数类型错误')
    }
    // 去掉开头结尾的反斜杠
    domainName = domainName.replace(/^\/|\/$/g, '')

    const fsContext = TmsContext.FsContext.insSync()
    domain = fsContext.getDomain(domainName)
    if (!domain) throw Error(`指定的文件服务[domain=${domainName}]不存在`)

    const appRootDir = fsContext.rootDir

    let prefix = domainName
    if (bucket) {
      // 去掉开头和结尾的反斜杠
      bucket = bucket.replace(/^\/|\/$/g, '')
      prefix += `/${bucket}`
    }

    if (!fs.existsSync(`${appRootDir}/${prefix}`))
      throw new Error(`指定的文件系统起始路径(${appRootDir}/${prefix})不存在`)

    this.tmsContext = TmsContext
    this[LFS_APPROOTDIR] = appRootDir
    this[LFS_PREFIX] = prefix
    this[LFS_DOMAIN] = domain
    this[LFS_BUCKET] = bucket
    /**
     * 缩略图存放位置和大小
     */
    const { thumbnail } = fsContext
    if (thumbnail && typeof thumbnail === 'object') {
      let thumbPrefix = `${domainName}/${thumbnail.dir || '_thumbs'}`
      if (bucket) thumbPrefix += `/${bucket}`
      let thumbRootDir = `${appRootDir}/${thumbPrefix}`
      this[LFS_THUMB_PREFIX] = thumbPrefix
      this[LFS_THUMB_ROOTDIR] = thumbRootDir
      this[LFS_THUMB_WIDTH] = parseInt(thumbnail.width) || 100
      this[LFS_THUMB_HEIGHT] = parseInt(thumbnail.height) || 100
    }
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
  get thumbRootdir() {
    return this[LFS_THUMB_ROOTDIR]
  }
  get thumbPrefix() {
    return this[LFS_THUMB_PREFIX]
  }
  get thumbWidth() {
    return this[LFS_THUMB_WIDTH]
  }
  get thumbHeight() {
    return this[LFS_THUMB_HEIGHT]
  }
  /**
   * 文件从rootDir开始
   *
   * @param {string} filename
   * @param {boolean} isRelative
   */
  pathWithRoot(filename, isRelative = true) {
    let fullpath = isRelative
      ? path.join(this.appRootDir, this.prefix, filename)
      : filename

    return fullpath
  }
  /**
   * 文件路径从domain开始
   *
   * @param {string} filename
   * @param {boolean} isRelative
   */
  pathWithPrefix(filename, isRelative = true) {
    let fullpath = isRelative ? path.join(this.prefix, filename) : filename

    return fullpath
  }
  /**
   * 缩略图位置
   *
   * @param {sting} filepath
   */
  private thumbPathWithRoot(filepath) {
    return path.join(this.thumbRootdir, filepath)
  }
  /**
   * 检查文件是否已经存在
   * @param {*} filepath
   * @param {*} isRelative
   */
  existsSync(filepath, isRelative = true) {
    // 文件的完整路径
    let fullpath = this.pathWithRoot(filepath, isRelative)
    return fs.existsSync(fullpath)
  }
  /**
   * 返回指定目录下的内容
   *
   * @param {string} dir
   */
  list(dir = '') {
    let dirRootpath = this.pathWithRoot(dir)

    if (!fs.existsSync(dirRootpath)) throw Error(`指定的目录不存在`)
    if (!fs.statSync(dirRootpath).isDirectory()) throw Error(`指定的不是目录`)

    let names = fs.readdirSync(path.resolve(dirRootpath))

    let files: TmsFile[] = []
    let dirs: TmsDir[] = []
    names.forEach((name) => {
      let publicUrl = path.join(this.prefix, dir, name)
      let resolvedPath = path.resolve(dirRootpath, name)

      // 排除缩略图目录下的文件
      if (this.thumbRootdir)
        if (new RegExp(`/${name}$`).test(this.thumbRootdir)) return

      let stat = fs.statSync(resolvedPath)
      if (stat.isFile()) {
        let fileinfo: any = {
          name,
          size: stat.size,
          birthtime: stat.birthtimeMs, // 有可能是0
          mtime: stat.mtimeMs,
          path: `${dir}/${name}`,
          publicUrl,
        }
        files.push(fileinfo)
        // 包含缩略图？
        if (this.thumbRootdir) {
          if (/\.[png|jpg|jpeg]/i.test(name))
            fileinfo.thumbUrl = path.join(this.thumbPrefix, dir, name)
        }
      } else if (stat.isDirectory()) {
        let dirents = fs.readdirSync(resolvedPath, { withFileTypes: true })
        let sub = { files: 0, dirs: 0 }
        dirents.forEach((dirent) => {
          dirent.isFile() ? sub.files++ : dirent.isDirectory ? sub.dirs++ : 0
        })
        dirs.push({
          name,
          birthtime: stat.birthtimeMs,
          sub,
          path: `${dir}/${name}`,
          publicUrl,
        })
      }
    })
    return { files, dirs }
  }
  /**
   * 写文件，如果已存在覆盖现有文件
   *
   * @param {string} filepath
   * @param {*} content
   * @param {boolean} isRelative
   */
  write(filepath, content, isRelative = true, options = {}) {
    // 文件的完整路径
    let storepath = this.pathWithRoot(filepath, isRelative)

    /* 文件目录是否存在，不存在则创建，默认权限777 */
    let dirname = path.dirname(storepath)
    fs.ensureDirSync(dirname, 0o2777)

    fs.writeFileSync(storepath, content, options)

    return filepath
  }
  /**
   * 保存通过koa-body上传的文件
   *
   * @param {string} filepath
   * @param {*} file
   * @param {*} isRelative
   */
  writeStream(filepath: string, file: File, isRelative = true) {
    // 文件的完整路径
    let storepath = this.pathWithRoot(filepath, isRelative)

    // 创建目录
    let dirname = path.dirname(storepath)
    fs.ensureDirSync(dirname, 0o2777)

    const reader = fs.createReadStream(file.filepath)
    // 创建可写流，如果文件已经存在替换已有文件
    const writer = fs.createWriteStream(storepath)
    // 可读流通过管道写入可写流
    reader.pipe(writer)

    return new Promise((resolve) => {
      writer.on('close', function () {
        resolve(filepath)
      })
    })
  }
  /**
   * 删文件
   *
   * @param {string} filepath
   * @param {*} isRelative
   */
  remove(filepath, isRelative = true) {
    let storepath = this.pathWithRoot(filepath, isRelative)

    if (!fs.existsSync(storepath)) throw Error(`指定的文件不存在`)

    fs.removeSync(storepath)

    return [true]
  }
  /**
   * 新建指定的目录
   *
   * @param {*} path
   */
  mkdir(path: string): [boolean, string?] {
    let storepath = this.pathWithRoot(path)
    if (fs.existsSync(storepath)) return [false, '目录已经存在，无法创建目录']

    fs.mkdirSync(storepath)

    return [true]
  }
  /**
   * 删除指定的目录
   *
   * @param {*} path
   */
  rmdir(path: string): [boolean, string?] {
    let storepath = this.pathWithRoot(path)
    if (!fs.existsSync(storepath)) return [false, '目录不存在，无法删除目录']

    const stat = fs.statSync(storepath)
    if (!stat.isDirectory()) return [false, '指定路径不是目录，无法删除目录']

    const names = fs.readdirSync(storepath)
    if (names.length) return [false, '目录不为空，无法删除目录']

    fs.rmdirSync(storepath)

    return [true]
  }
  /**
   * 生成缩略图
   * 目前只支持图片文件
   */
  async makeThumb(filepath, isRelative = true) {
    const ext = path.extname(filepath)
    if (!/\.[png|jpg|jpeg]/i.test(ext)) return false

    try {
      let name = 'sharp'
      const sharp = await import(name)
      const fullpath = isRelative ? this.pathWithRoot(filepath) : filepath
      const thumbPath = this.thumbPathWithRoot(filepath)

      const thumbnail = await sharp(fullpath)
        .resize(this.thumbWidth, this.thumbHeight, { fit: 'inside' })
        .toBuffer()

      this.write(thumbPath, thumbnail, false)
      // 获取文件信息
      let stat = fs.statSync(thumbPath)

      return {
        url: path.join(this.thumbPrefix, filepath),
        size: stat.size,
        width: this.thumbWidth,
        height: this.thumbHeight,
      }
    } catch (e) {
      console.log('生成缩略图失败，原因：', e.message)
      return false
    }
  }
}
