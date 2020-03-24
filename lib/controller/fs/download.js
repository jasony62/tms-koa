const { Ctrl } = require("../ctrl")
const { ResultData, ResultFault } = require('../../response')
const _ = require('lodash')
const fs = require('fs')
const path = require('path')

/**
 * excel管理控制器
 */
class DownloadCtrl extends Ctrl {
  constructor(...args) {
    super(...args)
  }
  /**
   * 下载文件
   *  path.normalize 规范化路径
   */
  async down () {
    let { file } = this.request.query
    if (typeof file !== "string") return new ResultFault("文件地址格式错误")

    let filePath = path.normalize(file)
    if (!fs.existsSync(filePath)) {
      if (fs.existsSync(process.cwd() + '/config/fs.js')) {
          let fsConfig = require(process.cwd() + '/config/fs')
          let outDir = _.get(fsConfig, ['local', 'outDir'], '')
          filePath = path.normalize(outDir + path.sep +  filePath)
          if (!fs.existsSync(filePath)) return new ResultFault("没有找到指定的文件") 
      } else {
        return new ResultFault("没有找到指定的文件") 
      }
    }

    let stream = fs.createReadStream(filePath)

    this.ctx.attachment(filePath)

    return stream
  }
}

module.exports = { DownloadCtrl }
