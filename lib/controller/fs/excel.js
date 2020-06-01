const xlsx = require('xlsx')
const _ = require('lodash')
const fs = require('fs')
const PATH = require('path')
//
const { LocalFS } = require('../../model/fs/local')
const { Upload } = require('../../model/fs/upload')
//
const { FsContext, appConfig } = require('../../app').Context

/**
 * excel文件管理控制器
 */
class ExcelCtrl {
  /**
   * 导出文件为xlsx
   * @param {*} columns 
   * @param {*} datas 
   * @param {*} fileName 
   * @param {*} options={} sheetName = sheet页名, forceReplace=重复文件是否覆盖 ‘N’, dir= 自定义存储路径
   */
  _export(columns, datas, fileName, options) {
    if (!columns || !datas) return [false, '参数错误']
    let { sheetName = '', forceReplace = 'Y', dir = '' } = options

    let jsonWorkSheet = xlsx.utils.json_to_sheet(
      datas.map(data => {
        let row = {}
        for (const k in columns) {
          let column = columns[k]
          row[column.title] = data[k]
        }
        return row
      })
    )
    // 构造workBook
    let workBook = {}
    if (!sheetName) sheetName = 'Sheet1'
    workBook.SheetNames = [sheetName]
    workBook.Sheets = {}
    workBook.Sheets[sheetName] = jsonWorkSheet

    const tmsFs = new LocalFS(this.domain)
    const uploadObj = new Upload(tmsFs)
    // 导出目录
    fileName = (fileName) ? fileName : uploadObj.autoname() + '.xlsx'
    let filePath = (dir && this.domain.customName === true) ? PATH.join(dir, fileName) : tmsFs.fullpath(PATH.join(uploadObj.autodir(), fileName))
    if (forceReplace === 'N') {
      // 如果文件已经存在
      if (fs.existsSync(filePath)) {
        return [false, '文件已经存在']
      }
    }

    if (!fs.existsSync(PATH.dirname(filePath))) fs.mkdirSync(PATH.dirname(filePath), { recursive: true })
    xlsx.writeFileSync(workBook, filePath, { compression: true, bookType: 'xlsx' })

    return [true, tmsFs.publicPath(filePath)]
  }
}

//
ExcelCtrl.init = (function () {
  if (!FsContext || !FsContext.insSync) return [false, '文件服务不可用']

  let _instance = new ExcelCtrl()
  _instance.fsContext = FsContext.insSync()

  let excelDomainName = _.get(appConfig, ['router', 'controllers', 'excel', 'defaultDomain'], '')
  if (excelDomainName) {
    if (!_instance.fsContext.isValidDomain(excelDomainName)) return [false, `指定的domain=${excelDomainName}不可用`]
    _instance.domain = _instance.fsContext.getDomain(excelDomainName)
  } else _instance.domain = _instance.fsContext.getDomain(_instance.fsContext.defaultDomain)

  return [true, _instance]
})()
//
ExcelCtrl.export = (columns, datas, fileName = '', options = {}) => {
  let _instance = ExcelCtrl.init
  if (_instance[0] === false) return _instance

  _instance = _instance[1]
  return _instance._export(columns, datas, fileName, options)
}

module.exports = { ExcelCtrl }
