const _ = require('lodash')
const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-koa-swagger')
const Router = require('@koa/router')

const { AppContext, MetricsContext } = require('../app').Context

/* 访问地址 */
let prefix = _.get(
  AppContext.insSync(),
  ['router', 'metrics', 'prefix'],
  '/metrics'
)
if (prefix && !/^\//.test(prefix)) prefix = `/${prefix}`

let msg = `启用监控服务，地址前缀：${prefix}。`
logger.info(msg)

const router = new Router()

router.get(prefix, async (ctx) => {
  let { request, response } = ctx

  const metricsContext = MetricsContext.insSync()

  const metrics = await metricsContext.register.metrics()

  response.body = metrics
})

module.exports = router
