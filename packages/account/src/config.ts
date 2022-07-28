const { loadConfig } = require('tms-koa')

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
