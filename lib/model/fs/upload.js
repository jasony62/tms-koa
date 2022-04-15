const fs = require('fs-extra')
const path = require('path')
const moment = require('moment')
const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-koa-model-fs-upload')

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
    this.fs = fs
  }
  get rootDir() {
    return this.fs.rootDir
  }
  get domain() {
    return this.fs.domain
  }
  get thumbWidth() {
    return this.fs.thumbWidth
  }
  get thumbHeight() {
    return this.fs.thumbHeight
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
  /**
   * 生成缩略图
   */
  async makeThumb(filepath, isRelative = true) {
    const sharp = require('sharp')
    if (!this.fs.thumbDir) return false

    const ext = path.extname(filepath)
    if (/\.[png|jpg|jpeg]/i.test(ext)) {
      const fullpath = isRelative ? this.fs.fullpath(filepath) : filepath
      const thumbPath = this.fs.thumbPath(filepath, isRelative)
      const thumbnail = await sharp(fullpath)
        .resize(this.thumbWidth, this.thumbHeight, { fit: 'inside' })
        .toBuffer()

      this.fs.write(thumbPath, thumbnail, false)
      // 获取文件信息
      let stat = fs.statSync(thumbPath)

      return {
        path: this.publicPath(thumbPath),
        size: stat.size,
        width: this.thumbWidth,
        height: this.thumbHeight,
      }
    }

    return false
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
   * @param {object} file
   * @param {string} dir 指定的文件存储目录
   * @param {string} forceReplace 如果文件已经存在是否替换
   *
   */
  async store(file, dir, forceReplace = 'N') {
    let filename
    if (this.domain.customName === true) {
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
  /**
   *
   * @param {string} fileUrl
   * @param {string} dir 指定的文件存储目录
   * @param {string} fileName 指定的文件名
   * @param {string} forceReplace 如果文件已经存在是否替换
   *
   */
  async storeByUrl(
    fileUrl,
    dir,
    forceReplace = 'N',
    fileName = '',
    axiosInstance = null
  ) {
    const axios = require('axios')

    if (
      !(
        {}.toString.call(axiosInstance) === '[object Function]' &&
        typeof axiosInstance.request === 'function'
      )
    ) {
      axiosInstance = axios.create({
        url: fileUrl,
        method: 'get',
        // transformRequest: [function (data, headers) {
        //   return JSON.stringify({aa: "bb" });
        // }]
      })
    }
    axiosInstance.defaults.responseType = 'arraybuffer' // 二进制数据的原始缓存区
    return axiosInstance
      .request()
      .catch((err) => {
        logger.error(err)
        throw new Error('未知错误: ' + fileUrl)
      })
      .then(async (file) => {
        if (file.status != '200') {
          throw new Error('下载失败: 状态码错误' + fileUrl)
        }
        if (file.headers['content-type'].indexOf('application/json') !== -1) {
          throw new Error('下载失败, 返回类型错误: ' + fileUrl)
        }
        if (!fileName) {
          if (file.headers['content-disposition']) {
            let dispositions = file.headers['content-disposition'].replace(
              /\s/g,
              ''
            )
            dispositions = dispositions.split(';')
            dispositions.forEach((dis) => {
              let disArr = dis.split('=')
              if (disArr[0] === 'filename')
                fileName = disArr[1].replace(/('|")/g, '')
            })
          }
        }

        if (this.domain.customName === true) {
          if (!fileName) fileName = this.autoname() // 生成无后缀的文件名
          // 去掉指定目录开头或结尾的反斜杠
          dir = typeof dir === 'string' ? dir.replace(/(^\/|\/$)/g, '') : ''
          if (dir.length) {
            fileName = `${dir}/${fileName}`
          } else {
            fileName = this.autodir() + '/' + fileName
          }
        } else {
          let ext = path.extname(fileName)
          fileName = this.storename(ext)
        }

        if (forceReplace !== 'Y') {
          // 如果文件已经存在
          if (this.fs.existsSync(fileName)) {
            throw new Error('文件已经存在')
          }
        }

        let filepath = await this.fs.write(fileName, file.data, true, {
          encoding: 'binary',
        })

        return filepath
      })
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

    let filename
    if (this.domain.customName === true) {
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
}

module.exports = { Upload, UploadPlain, UploadImage }
