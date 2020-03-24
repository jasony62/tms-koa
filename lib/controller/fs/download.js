const { Ctrl } = require('../ctrl')
const _ = require('lodash')
const fs = require('fs')

/**
 * excel管理控制器
 */
class DownloadCtrl extends Ctrl {
  constructor(...args) {
    super(...args)
  }
  /**
   * 上传Base64格式的文件
   */
  async down() {
    let { file } = this.request.query
    if (!file) return '缺少参数'

    let outPath = process.cwd() + '/public'
    if (fs.existsSync(process.cwd() + '/config/fs.js')) {
      let fsConfig = require(process.cwd() + '/config/fs')
      let outPath2 = _.get(fsConfig, ['local', 'outDir'], '')
      if (outPath2) outPath = outPath2
    }

    let filePath = outPath + '/' + file
    if (!fs.existsSync(filePath)) return '指定文件不存在'

    let stream = fs.createReadStream(filePath)

    this.ctx.attachment(filePath)

    return stream
  }
}

module.exports = { DownloadCtrl }
