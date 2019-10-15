const fs = require('fs-extra')
const path = require('path')
/**
 * 本地文件系统
 */
const LFS_ROOTDIR = Symbol('lfs_rootDir')
const LFS_DOMAIN = Symbol('lfs_domain')

class LocalFS {
  /**
   *
   * @param {string} domain
   * @param {*} param1
   */
  constructor(domain, { fileConfig } = {}) {
    if (!fileConfig) fileConfig = require(process.cwd() + '/config/fs')

    if (typeof fileConfig.local !== 'object') throw new Error('没有提供文件系统配置信息(local)')

    if (typeof fileConfig.local.rootDir !== 'string') throw new Error('没有提供文件系统配置信息(local.rootDir)')

    if (typeof domain !== 'string' || domain.length === 0) throw new Error('没有提供文件起始存储位置')

    const appRootDir = fileConfig.local.rootDir.replace(/\/$/, '') // 如果有替换掉结尾的斜杠
    domain = domain.replace(/^\/|\/$/g, '')

    let rootDir = `${appRootDir}/${domain}`
    if (!fs.existsSync(rootDir)) {
      throw new Error(`指定的文件系统起始路径(${rootDir})不存在`)
    }
    this[LFS_ROOTDIR] = rootDir
    this[LFS_DOMAIN] = domain
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
        files.push({ name, size: stats.size, birthtime: stats.birthtimeMs })
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
