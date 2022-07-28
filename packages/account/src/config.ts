const fs = require('fs')
const path = require('path')
const _ = require('lodash')
const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-koa-account-config')

/**
 * 获得配置数据
 *
 * @param {string} name - 配置名称
 * @param {object} defaultConfig - 默认配置
 *
 * @return {object} 配置数据对象
 */
function loadConfig(name, defaultConfig) {
  let basepath = path.resolve('config', `${name}.js`)
  let baseConfig
  if (fs.existsSync(basepath)) {
    baseConfig = require(basepath)
    logger.info(`从[${basepath}]加载配置`)
  } else {
    logger.warn(`[${name}]配置文件[${basepath}]不存在`)
  }
  let localpath = path.resolve('config', `${name}.local.js`)
  let localConfig
  if (fs.existsSync(localpath)) {
    localConfig = require(localpath)
    logger.info(`从[${localpath}]加载本地配置`)
  }
  if (defaultConfig || baseConfig || localConfig) {
    return _.merge({}, defaultConfig, baseConfig, localConfig)
  }

  return false
}

const AccountConfig = (function () {
  let accountConfig
  return function () {
    if (accountConfig) {
      return accountConfig
    } else {
      accountConfig = loadConfig('account', {})
      return accountConfig
    }
  }
})()
const AppConfig = (function () {
  let appConfig
  return function () {
    if (appConfig) {
      return appConfig
    } else {
      appConfig = loadConfig('app', { port: 3000 })
      return appConfig
    }
  }
})()

export = { AccountConfig: AccountConfig(), AppConfig: AppConfig(), loadConfig }
