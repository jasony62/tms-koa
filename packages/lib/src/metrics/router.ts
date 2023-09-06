import _ from 'lodash'
import log4js from '@log4js-node/log4js-api'
import Router from '@koa/router'
import { Context } from '../app.js'

const { AppContext, MetricsContext } = Context
const logger = log4js.getLogger('tms-koa-swagger')

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
  let { response } = ctx

  const metricsContext = MetricsContext.insSync()

  const metrics = await metricsContext.client.register.metrics()
  response.body = metrics
})

export { router }
