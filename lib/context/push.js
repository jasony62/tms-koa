/**
 * 消息推送服务
 */
const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-koa-push')

const MAP_SOCKETS = Symbol('push.map_sockets')
class Context {
  constructor(io) {
    this.io = io
    // 保存建立的连接
    this[MAP_SOCKETS] = new Map()
  }
  getSocket(id) {
    return this[MAP_SOCKETS].get(id)
  }
}
Context.init = (function () {
  let _instance
  return async function (pushConfig) {
    if (_instance) return _instance
    const app = require('http').createServer()
    const io = require('socket.io')(app)
    _instance = new Context(io)
    return new Promise((resolve) => {
      app.listen(pushConfig.port, () => {
        logger.info(`完成推送服务启动，开始监听端口：${pushConfig.port}`)
        io.on('connection', function (socket) {
          _instance[MAP_SOCKETS].set(socket.id, socket)
          socket.emit('tms-koa-push', { status: 'connected' })
        })
        resolve(_instance)
      })
    })
  }
})()

Context.ins = Context.init

module.exports = { Context }
