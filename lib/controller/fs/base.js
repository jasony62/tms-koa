const fs = require('fs')
const _ = require('lodash')
const { Ctrl } = require('../ctrl')
const { ResultData, ResultFault } = require('../../response')
/**
 * 文件管理控制器
 */
class BaseCtrl extends Ctrl {
  constructor(...args) {
    super(...args)
    const fsConfig = require(process.cwd() + '/config/fs')
    this.fsConfig = fsConfig
  }
  get fsDb() {
    let dialect = _.get(this.fsConfig, ['local', 'database', 'dialect'])
    if (!dialect) {
      return false
    }
    const dbCtx = this.dbContext
    let fsDb = dbCtx[dialect]

    return fsDb
  }
  /**
   * 返回扩展信息定义
   */
  schemas() {
    let fsConfigPath = process.cwd() + '/config/fs.js'
    if (!fs.existsSync(fsConfigPath)) {
      return new ResultFault('没有配置文件服务')
    }
    let fsConfig = require(fsConfigPath)

    let { schemas } = fsConfig.local
    if (!Array.isArray(schemas)) {
      return new ResultFault('文件服务没有设置扩展信息定义')
    }

    return new ResultData(schemas)
  }
}
module.exports = { BaseCtrl, ResultData }
