const { Upload } = require('../../model/fs/upload')
const xlsx = require('xlsx')
const _ = require('lodash')
const fs = require('fs')
const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-koa-ctrl')

/**
 * excel管理控制器
 */
class ExcelCtrl {
  /**
   * 上传Base64格式的文件
   */
  static export(columns, data, fileName = '', sheetName = "") {
    if (!columns || !data) return [false, "缺少参数"] 

    let jsonWorkSheet = xlsx.utils.json_to_sheet(
        data.map(row => {
            let row2 = {}
            for (const k in columns) {
                let column = columns[k]
                row2[column.title] = row[k]
            }
            return row2
        })
    )
    // 构造workBook
    let workBook = {}
    if (!sheetName) sheetName = "Sheet1"
    workBook.SheetNames = [ sheetName ]
    workBook.Sheets = {}
    workBook.Sheets[sheetName] = jsonWorkSheet

    // 导出目录
    let outPath = process.cwd() + '/public'
    if (fs.existsSync(process.cwd() + '/config/fs.js')) {
      let fsConfig = require(process.cwd() + '/config/fs')
      let outPath2 = _.get(fsConfig, ['local', 'outDir'], '')
      if (outPath2) outPath = outPath2
    }
    
    let upload = new Upload()
    let filePath
    if (fileName) {
        filePath = upload.storename(fileName + '.xlsx')
    } else {
        filePath = upload.storename('.xlsx')
    }

    let fileName2 = outPath + '/' + filePath
    // 获取文件路径
    let fileDirPath = fileName2.substr(0, fileName2.lastIndexOf("/") + 1)
    if (!fs.existsSync(fileDirPath)) {
      fs.mkdirSync(fileDirPath, { recursive: true}, (err) => {
        if (err) {
          let logMsg = err.toString()
          logger.isDebugEnabled() ? logger.debug(logMsg) : logger.error(logMsg)
        }
      })
    }

    xlsx.writeFile(workBook, fileName2)

    return [true, fileName2.replace(outPath + '/', "")]
  }
}

module.exports = { ExcelCtrl }
