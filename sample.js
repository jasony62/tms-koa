const log4jsConfig = require('./config/log4js')
const log4js = require('log4js')
log4js.configure(log4jsConfig)

const { TmsKoa } = require('./lib/app')

const tmsKoa = new TmsKoa()

const middleware = async (ctx, next) => {
  const start = Date.now()
  await next()
  const ms = Date.now() - start
  ctx.set('X-Response-Time', `${ms}ms`)
}

tmsKoa.startup({ beforeController: [middleware] })
