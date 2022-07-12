const { TmsKoa } = require('./app')
const debug = require('debug')('tms-koa:startup')

const tmsKoa = new TmsKoa()

debug('启动tms-koa')
tmsKoa.startup({
  afterInit: () => {
    debug('完成tms-koa初始化')
  },
})
