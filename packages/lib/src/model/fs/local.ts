const fs = require('fs-extra')
const path = require('path')
const _ = require('lodash')

import type { File } from 'formidable'

/**
 * 本地文件系统
 */
const LFS_APPROOTDIR = Symbol('lfs_appRootDir')
const LFS_ROOTDIR = Symbol('lfs_rootDir')
const LFS_DOMAIN = Symbol('lfs_domain')
const LFS_BUCKET = Symbol('lfs_bucket')
const LFS_THUMBDIR = Symbol('lfs_rootThumb')
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
      if (!domain) Error('文件服务[domain]参数类型错误')
    }

    const fsContext = TmsContext.FsContext.insSync()
    domain = fsContext.getDomain(domainName)
    if (!domain) throw Error(`指定的文件服务[domain=${domainName}]不存在`)

    const appRootDir = fsContext.rootDir

    domainName = domainName.replace(/^\/|\/$/g, '')

    let rootDir = `${appRootDir}/${domainName}`
    if (bucket) {
      bucket = bucket.replace(/^\/|\/$/g, '')
      rootDir += `/${bucket}`
    }

    if (!fs.existsSync(rootDir))
      throw new Error(`指定的文件系统起始路径(${rootDir})不存在`)

    this.tmsContext = TmsContext
    this[LFS_APPROOTDIR] = appRootDir
    this[LFS_ROOTDIR] = rootDir
    this[LFS_DOMAIN] = domain
    this[LFS_BUCKET] = bucket
    /**
     * 缩略图存放位置
     */
    const { thumbnail } = fsContext
    if (thumbnail && typeof thumbnail === 'object') {
      // this[LFS_THUMBDIR] = `${rootDir}/${thumbnail.dir || '_thumbs'}`
      let thumbnailRootDir = `${appRootDir}/${domainName}/${
        thumbnail.dir || '_thumbs'
      }`
      if (bucket) thumbnailRootDir += `/${bucket}`
      this[LFS_THUMBDIR] = thumbnailRootDir
      this[LFS_THUMB_WIDTH] = parseInt(thumbnail.width) || 100
      this[LFS_THUMB_HEIGHT] = parseInt(thumbnail.height) || 100
    }
  }
  get appRootDir() {
    return this[LFS_APPROOTDIR]
  }
  get rootDir() {
    return this[LFS_ROOTDIR]
  }
  get thumbDir() {
    return this[LFS_THUMBDIR]
  }
  get thumbWidth() {
    return this[LFS_THUMB_WIDTH]
  }
  get thumbHeight() {
    return this[LFS_THUMB_HEIGHT]
  }
  get domain() {
    return this[LFS_DOMAIN]
  }
  /**
   * 文件的完整路径
   *
   * @param {string} filename
   * @param {boolean} isRelative
   */
  fullpath(filename, isRelative = true) {
    let fullpath = isRelative ? path.join(this.rootDir, filename) : filename

    return fullpath
  }
  /**
   * 用于公开访问的路径，例如：下载
   *
   * 去掉rootDir部分，从domain开始，如果设置了文件下载服务，添加下载服务前缀
   *
   * @param {string} fullpath
   */
  publicPath(fullpath) {
    let publicPath = fullpath.replace(path.normalize(this.appRootDir), '')

    /* 如果开放了文件下载服务添加前缀 */
    const { AppContext } = this.tmsContext
    const prefix = _.get(AppContext.insSync(), 'router.fsdomain.prefix')
    if (prefix) publicPath = path.join(prefix, publicPath)

    return publicPath
  }
  /**
   * 在domain中的路径
   *
   * @param {string} fullpath
   */
  relativePath(fullpath) {
    let relativePath = fullpath.replace(path.normalize(this.rootDir), '')

    return relativePath
  }
  /**
   * 缩略图位置
   *
   * @param {sting} filename
   * @param {boolean} isRelative
   */
  thumbPath(filename, isRelative = true) {
    const thumbpath = path.join(
      this.thumbDir,
      isRelative ? filename : this.relativePath(filename)
    )

    return thumbpath
  }
  /**
   *
   * @param {*} filename
   * @param {*} isRelative
   */
  existsSync(filename, isRelative = true) {
    // 文件的完整路径
    let fullpath = this.fullpath(filename, isRelative)

    return fs.existsSync(fullpath)
  }
  /**
   * 返回指定目录下的内容
   *
   * @param {string} dir
   */
  list(dir = '') {
    let fullpath = this.fullpath(dir)
    let names = fs.readdirSync(path.resolve(fullpath))

    let files = []
    let dirs = []
    names.forEach((name) => {
      let resolvedPath = path.resolve(fullpath, name)

      if (this.thumbDir) {
        if (new RegExp(`/${name}$`).test(this.thumbDir)) return
      }

      let stats = fs.statSync(resolvedPath)
      if (stats.isFile()) {
        let publicPath = path.join(this.publicPath(fullpath), name)
        let fileinfo: any = {
          name,
          size: stats.size,
          birthtime: stats.birthtimeMs,
          path: publicPath,
        }
        files.push(fileinfo)
        if (/\.[png|jpg|jpeg]/i.test(name)) {
          if (this.thumbDir) {
            let thumbPath = this.publicPath(
              path.join(this.thumbPath(fullpath, false), name)
            )
            fileinfo.thumbPath = thumbPath
          }
        }
      } else if (stats.isDirectory()) {
        let dirents = fs.readdirSync(resolvedPath, { withFileTypes: true })
        let sub = { files: 0, dirs: 0 }
        dirents.forEach((dirent) => {
          dirent.isFile() ? sub.files++ : dirent.isDirectory ? sub.dirs++ : 0
        })
        dirs.push({ name, birthtime: stats.birthtimeMs, sub })
      }
    })
    return { files, dirs }
  }
  /**
   * 写文件，如果已存在覆盖现有文件
   *
   * @param {string} filename
   * @param {*} content
   * @param {boolean} isRelative
   */
  write(filename, content, isRelative = true, options = {}) {
    // 文件的完整路径
    let fullpath = this.fullpath(filename, isRelative)

    /* 文件目录是否存在，不存在则创建，默认权限777 */
    let dirname = path.dirname(fullpath)
    fs.ensureDirSync(dirname, 0o2777)

    fs.writeFileSync(fullpath, content, options)

    return fullpath
  }
  /**
   * 保存通过koa-body上传的文件
   *
   * @param {string} filename
   * @param {*} file
   * @param {*} isRelative
   */
  writeStream(filename: string, file: File, isRelative = true) {
    // 文件的完整路径
    let fullpath = this.fullpath(filename, isRelative)

    // 创建目录
    let dirname = path.dirname(fullpath)
    fs.ensureDirSync(dirname, 0o2777)

    const reader = fs.createReadStream(file.filepath)
    // 创建可写流，如果文件已经存在替换已有文件
    const writer = fs.createWriteStream(fullpath)
    // 可读流通过管道写入可写流
    reader.pipe(writer)

    return new Promise((resolve) => {
      writer.on('close', function () {
        resolve(fullpath)
      })
    })
  }
  /**
   * 删文件
   *
   * @param {string} filename
   * @param {*} isRelative
   */
  remove(filename, isRelative = true) {
    let fullpath = this.fullpath(filename, isRelative)
    fs.removeSync(fullpath)
  }
}
