const fs = require('fs-extra')
const path = require('path')
/**
 * 本地文件系统
 */
const LFS_APPROOTDIR = Symbol('lfs_appRootDir')
const LFS_ROOTDIR = Symbol('lfs_rootDir')
const LFS_DOMAIN = Symbol('lfs_domain')
const LFS_BUCKET = Symbol('lfs_bucket')

class LocalFS {
  /**
   *
   * @param {object} domain
   * @param {string} bucket
   */
  constructor(domain, bucket = '') {
    if (!domain || typeof domain !== 'object')
      throw new Error('没有提供文件服务[domain]参数')
    let domainName = domain.name
    if (typeof domainName !== 'string' || domainName.length === 0)
      throw new Error('没有提供文件服务[domain.name]参数')

    const fsContext = this.getFsContext()
    const appRootDir = fsContext.rootDir

    domainName = domainName.replace(/^\/|\/$/g, '')

    let rootDir = `${appRootDir}/${domainName}`
    if (bucket) {
      bucket = bucket.replace(/^\/|\/$/g, '')
      rootDir += `/${bucket}`
    }

    if (!fs.existsSync(rootDir))
      throw new Error(`指定的文件系统起始路径(${rootDir})不存在`)

    this[LFS_APPROOTDIR] = appRootDir
    this[LFS_ROOTDIR] = rootDir
    this[LFS_DOMAIN] = domain
    this[LFS_BUCKET] = bucket
  }
  // 为了能够替换配置信息
  getFsContext() {
    const FsContext = require('../../fs').Context
    if (!FsContext.insSync) throw new Error(`没有获得文件服务配置信息`)

    const fsContext = FsContext.insSync()

    return fsContext
  }
  get appRootDir() {
    return this[LFS_APPROOTDIR]
  }
  get rootDir() {
    return this[LFS_ROOTDIR]
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
    filename = filename.replace(/^\//, '')
    let fullpath = isRelative ? path.join(this.rootDir, filename) : filename

    return fullpath
  }
  /**
   * 用于公开访问的路径，例如：下载
   *
   * 去掉rootDir部分，从domain开始
   *
   * @param {*} fullpath
   */
  publicPath(fullpath) {
    let publicPath = fullpath.replace(this.appRootDir, '')

    return publicPath
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
    names.forEach(name => {
      let resolvedPath = path.resolve(fullpath, name)
      let stats = fs.statSync(resolvedPath)
      if (stats.isFile()) {
        let publicPath = path.join(this.publicPath(fullpath), name)
        files.push({
          name,
          size: stats.size,
          birthtime: stats.birthtimeMs,
          path: publicPath
        })
      } else if (stats.isDirectory()) {
        let dirents = fs.readdirSync(resolvedPath, { withFileTypes: true })
        let sub = { files: 0, dirs: 0 }
        dirents.forEach(dirent => {
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
  write(filename, content, isRelative = true) {
    // 文件的完整路径
    let fullpath = this.fullpath(filename, isRelative)

    /* 文件目录是否存在，不存在则创建，默认权限777 */
    let dirname = path.dirname(fullpath)
    fs.ensureDirSync(dirname, 0o2777)

    fs.writeFileSync(fullpath, content)

    return fullpath
  }
  /**
   * 保存通过koa-body上传的文件
   *
   * @param {string} filename
   * @param {*} file
   * @param {*} isRelative
   */
  writeStream(filename, file, isRelative = true) {
    // 文件的完整路径
    let fullpath = this.fullpath(filename, isRelative)

    // 创建目录
    let dirname = path.dirname(fullpath)
    fs.ensureDirSync(dirname, 0o2777)

    const reader = fs.createReadStream(file.path)
    // 创建可写流，如果文件已经存在替换已有文件
    const writer = fs.createWriteStream(fullpath)
    // 可读流通过管道写入可写流
    reader.pipe(writer)

    return new Promise(resolve => {
      writer.on('close', function() {
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

module.exports = { LocalFS }
