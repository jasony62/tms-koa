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
     * 返回上传后的文件
     */
    storename(ext) {
        let name

        name = moment().format('YYYYMM/DDHH/mmss') + (Math.floor(Math.random() * (9999 - 1000)) + 1000)
        name += `.${ext}`

        return name
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
    storeBase64(base64Content) {
        if (!base64Content) return false

        let matches = base64Content.match(/data:image\/(\w+);base64,/)
        if (!matches || matches.length !== 2)
            return false
        let [header, imageType] = matches
        if (imageType === 'jpeg') imageType = 'jpg'

        let imageBase64 = base64Content.replace(header, '')
        let imageBuffer = Buffer.from(imageBase64, 'base64')

        let filename = this.storename(imageType)

        let fullname = this.fs.write(filename, imageBuffer)

        return fullname
    }
    /**
     * 将指定的url保存到本地
     * 
     * @param {string} url 图片的地址
     */
    storeByUrl(url) {}
    /**
     * 压缩本地图片
     */
    compact() {

    }
}

module.exports = { Upload, UploadImage }