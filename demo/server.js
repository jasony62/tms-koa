const log4jsConfig = require('./config/log4js')
const log4js = require('log4js')
log4js.configure(log4jsConfig)
const logger = log4js.getLogger('tms-koa-demo')
const { TmsKoa } = require('tms-koa')

const tmsKoa = new TmsKoa()

const beforeMiddleware = async (ctx, next) => {
  const start = Date.now()
  await next()
  const ms = Date.now() - start
  ctx.set('X-Response-Time', `${ms}ms`)
}
console.log('llll', logger.appenders)
logger.info('启动tms-koa')
tmsKoa.startup({
  beforeController: [beforeMiddleware],
  afterInit: () => {
    logger.info('完成tms-koa初始化')
  },
})
