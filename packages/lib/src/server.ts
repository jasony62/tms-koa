import { TmsKoa } from './app.js'
import Debug from 'debug'

const debug = Debug('tms-koa:startup')

const tmsKoa = new TmsKoa()

debug('启动tms-koa')
tmsKoa.startup({
  afterInit: () => {
    debug('完成tms-koa初始化')
  },
})
