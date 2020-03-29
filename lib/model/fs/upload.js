const path = require('path')
const moment = require('moment')
/**
 * 上传文件
 */
class Upload {
  /**
   * 管理上传文件
   *
   * @param {LocalFS} fs 存储接口
   */
  constructor(fs) {
    if (!fs) {
      const { LocalFS } = require('./local')
      // TODO 写死upload合适吗？
      fs = new LocalFS('upload')
    }
    this.fs = fs
  }
  get rootDir() {
    return this.fs.rootDir
  }
  get domain() {
    return this.fs.domain
  }
  /**
   * 自动生成的存储目录
   */
  autodir() {
    let dir

    dir = moment().format('YYYYMM/DDHH')

    return dir
  }
  /**
   * 自动生成的文件名（不含扩展名）
   */
  autoname() {
    let name

    name =
      moment().format('mmss') +
      +(Math.floor(Math.random() * (9999 - 1000)) + 1000)

    return name
  }
  /**
   * 返回上传后的文件
   * @param {string} ext 文件的扩展名
   */
  storename(ext) {
    let name

    name = this.autodir() + '/' + this.autoname()
    name += /^\./.test(ext) ? ext : `.${ext}`

    return name
  }
  /**
   * 用于公开访问的路径，例如：下载
   *
   * 去掉rootDir部分，从domain开始
   *
   * @param {*} fullpath
   */
  publicPath(fullpath) {
    return this.fs.publicPath(fullpath)
  }
}
/**
 * 上传文件
 */
class UploadPlain extends Upload {
  /**
   *
   * @param {*} fs
   */
  constructor(fs) {
    super(fs)
  }
  /**
   *
   * @param {*} file
   * @param {string} dir 指定的文件存储目录
   * @param {string} forceReplace 如果文件已经存在是否替换
   *
   */
  async store(file, dir, forceReplace = 'N') {
    const fsContext = this.fs.getFsContext()
    let filename
    if (fsContext.customName === true) {
      // 去掉指定目录开头或结尾的反斜杠
      dir = typeof dir === 'string' ? dir.replace(/(^\/|\/$)/g, '') : ''
      if (dir.length) {
        filename = `${dir}/${file.name}`
      } else {
        filename = this.autodir() + '/' + file.name
      }
    } else {
      let ext = path.extname(file.name)
      filename = this.storename(ext)
    }
    if (forceReplace !== 'Y') {
      // 如果文件已经存在
      if (this.fs.existsSync(filename)) {
        throw new Error('文件已经存在')
      }
    }
    let filepath = await this.fs.writeStream(filename, file)

    return filepath
  }
}
/**
 * 上传图片
 */
class UploadImage extends Upload {
  constructor(fs) {
    super(fs)
  }
  /**
   * 保存base64格式的图片
   *
   * @param {string} base64Content
   */
  storeBase64(base64Content, dir, forceReplace = 'N') {
    if (!base64Content) return false

    let matches = base64Content.match(/data:image\/(\w+);base64,/)
    if (!matches || matches.length !== 2)
      throw new Error('保存的数据不是base64格式的图片')

    let [header, imageType] = matches
    if (imageType === 'jpeg') imageType = 'jpg'

    let imageBase64 = base64Content.replace(header, '')
    let imageBuffer = Buffer.from(imageBase64, 'base64')

    const fsContext = this.fs.getFsContext()
    let filename
    if (fsContext.customName === true) {
      // 去掉指定目录开头或结尾的反斜杠
      dir = typeof dir === 'string' ? dir.replace(/(^\/|\/$)/g, '') : ''
      if (dir.length) {
        filename = `${dir}/${this.autoname()}.${imageType}`
      } else {
        filename = this.storename(imageType)
      }
    } else {
      filename = this.storename(imageType)
    }
    if (forceReplace !== 'Y') {
      // 如果文件已经存在
      if (this.fs.existsSync(filename)) {
        throw new Error('文件已经存在')
      }
    }
    let fullname = this.fs.write(filename, imageBuffer)

    return fullname
  }
  /**
   * 将指定的url保存到本地
   *
   * @param {string} url 图片的地址
   */
  storeByUrl() {}
  /**
   * 压缩本地图片
   */
  compact() {}
}

module.exports = { Upload, UploadPlain, UploadImage }
