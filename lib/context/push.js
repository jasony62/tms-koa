/**
 * 消息推送服务
 */
const fs = require('fs')
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
    /**
     * 启用http端口
     */
    if (typeof pushConfig.https === 'object') {
      const { port, key, cert } = pushConfig.https
      if (parseInt(port) && fs.existsSync(key) && fs.existsSync(cert)) {
        const httpsServer = require('https').createServer({
          key: fs.readFileSync(key, 'utf8').toString(),
          cert: fs.readFileSync(cert, 'utf8').toString(),
        })
        const io = require('socket.io')(httpsServer)
        _instance = new Context(io)
        return new Promise((resolve, reject) => {
          httpsServer.listen(port, (err) => {
            if (err) {
              logger.error(`启动推送服务https端口【${port}】失败: `, err)
              reject(err)
            } else {
              logger.info(`完成启动推送服务https端口：${port}`)
              io.on('connection', (socket) => {
                _instance[MAP_SOCKETS].set(socket.id, socket)
                socket.emit('tms-koa-push', { status: 'connected' })
              })
              resolve(_instance)
            }
          })
        })
      }
    } else if (parseInt(pushConfig.port)) {
      const httpServer = require('http').createServer()
      const io = require('socket.io')(httpServer)
      _instance = new Context(io)
      return new Promise((resolve) => {
        httpServer.listen(pushConfig.port, () => {
          logger.info(`完成推送服务启动，开始监听端口：${pushConfig.port}`)
          io.on('connection', (socket) => {
            _instance[MAP_SOCKETS].set(socket.id, socket)
            socket.emit('tms-koa-push', { status: 'connected' })
          })
          resolve(_instance)
        })
      })
    }
    /**
     * 启用https端口
     */
  }
})()

Context.ins = Context.init

module.exports = { Context }
