import path from 'path'
import { LocalFS, MinioFS } from './index.js'
import dayjs from 'dayjs'
import type { File } from 'formidable'
import log4js from '@log4js-node/log4js-api'

const logger = log4js.getLogger('tms-koa-model-fs-upload')

/**
 * 上传文件
 */
export class Upload {
  fs: LocalFS | MinioFS
  /**
   * 管理上传文件
   *
   * @param {LocalFS} fs 存储接口
   */
  constructor(fs: LocalFS | MinioFS) {
    this.fs = fs
  }
  get rootDir() {
    return this.fs.prefix
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

    dir = dayjs().format('YYYYMM/DDHH')

    return dir
  }
  /**
   * 自动生成的文件名（不含扩展名）
   */
  autoname() {
    let name

    name =
      dayjs().format('mmss') +
      +(Math.floor(Math.random() * (9999 - 1000)) + 1000)

    return name
  }
  /**
   * 返回上传后的文件
   * @param {string} ext 文件的扩展名
   */
  storename(ext: string) {
    let name

    name = this.autodir() + '/' + this.autoname()
    name += /^\./.test(ext) ? ext : `.${ext}`

    return name
  }
  /**
   * 生成缩略图
   */
  async makeThumb(filepath) {
    return this.fs.makeThumb(filepath)
  }
}
/**
 * 上传文件
 */
export class UploadPlain extends Upload {
  /**
   *
   * @param {*} fs
   */
  constructor(fs: LocalFS | MinioFS) {
    super(fs)
  }
  /**
   * 保存文件
   * @param {object} file
   * @param {string} dir 指定的文件存储目录
   * @param {string} forceReplace 如果文件已经存在是否替换
   *
   */
  async store(file: File, dir, forceReplace = 'N') {
    let filename // 本地文件名
    if (this.domain.customName === true) {
      // 去掉指定目录开头或结尾的反斜杠
      dir = typeof dir === 'string' ? dir.replace(/(^\/|\/$)/g, '') : ''
      if (dir.length) {
        filename = `${dir}/${file.originalFilename}`
      } else {
        filename = this.autodir() + '/' + file.originalFilename
      }
    } else {
      /**自动生成本地文件名称*/
      let ext = path.extname(file.originalFilename)
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
   * 将指定的远程文件保存在指定位置
   * @param {string} fileUrl
   * @param {string} dir 指定的文件存储目录
   * @param {string} fileName 指定的文件名
   * @param {string} forceReplace 如果文件已经存在是否替换
   *
   */
  async storeByUrl(fileUrl, dir, forceReplace = 'N', fileName = '') {
    if (!fileUrl) throw new Error('没有指定要下砸的文件地址')

    const response = await fetch(fileUrl)

    if (response.status !== 200) {
      throw new Error('下载失败: 状态码错误')
    }
    /**
     * 如果是下载文件，获得其中携带的文件名信息
     */
    if (!fileName && response.headers.has('Content-Disposition')) {
      let dispositions: any = response.headers
        .get('Content-Disposition')
        .replace(/\s/g, '')
      dispositions = dispositions.split(';')
      dispositions.forEach((dis) => {
        let disArr = dis.split('=')
        if (disArr[0] === 'filename') fileName = disArr[1].replace(/('|")/g, '')
      })
    }
    /**
     * 生成文件名
     */
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
      const contentType = response.headers.get('Content-Type')
      const ext = contentType.split('/')[1]
      fileName = this.storename(ext)
    }

    if (forceReplace !== 'Y') {
      // 如果文件已经存在
      if (this.fs.existsSync(fileName)) {
        throw new Error('文件已经存在')
      }
    }

    const blob = await response.blob()
    const size = blob.size
    const content = Buffer.from(await blob.arrayBuffer())
    const filepath = await this.fs.write(fileName, content, true, {
      encoding: 'binary',
    })

    return { path: filepath, size }
  }
}
/**
 * 上传图片
 */
export class UploadImage extends Upload {
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

    let filepath
    if (this.domain.customName === true) {
      // 去掉指定目录开头或结尾的反斜杠
      dir = typeof dir === 'string' ? dir.replace(/(^\/|\/$)/g, '') : ''
      if (dir.length) {
        filepath = `${dir}/${this.autoname()}.${imageType}`
      } else {
        filepath = this.storename(imageType)
      }
    } else {
      filepath = this.storename(imageType)
    }
    if (forceReplace !== 'Y') {
      // 如果文件已经存在
      if (this.fs.existsSync(filepath))
        throw new Error(`文件【${filepath}】已经存在`)
    }

    this.fs.write(filepath, imageBuffer)

    return filepath
  }
  /**
   * 将指定的url保存到本地
   *
   * @param {string} url 图片的地址
   */
  storeByUrl() {}
}
