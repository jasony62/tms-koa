import log4js from 'log4js'
import { TmsKoa } from 'tms-koa'
import log4jsConfig from '../config/log4js.js'

log4js.configure(log4jsConfig)
const logger = log4js.getLogger('tms-koa-demo')

const tmsKoa = new TmsKoa()

const beforeMiddleware = async (ctx, next) => {
  const start = Date.now()
  await next()
  const ms = Date.now() - start
  ctx.set('X-Response-Time', `${ms}ms`)
}

logger.info('启动tms-koa')
tmsKoa.startup({
  beforeController: [beforeMiddleware],
  afterInit: () => {
    logger.info('完成tms-koa初始化')
  },
})
