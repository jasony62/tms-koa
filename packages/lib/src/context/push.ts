/**
 * 消息推送服务
 */
import fs from 'fs'
import log4js from '@log4js-node/log4js-api'

const logger = log4js.getLogger('tms-koa-push')

const MAP_SOCKETS = Symbol('push.map_sockets')
const MAP_HTTPS_SOCKETS = Symbol('push.map_https_sockets')

let _instance

export class Context {
  constructor() {
    // 保存建立的连接
    this[MAP_SOCKETS] = new Map()
    this[MAP_HTTPS_SOCKETS] = new Map()
  }

  getSocket(id) {
    return this[MAP_SOCKETS].get(id)
  }

  getHttpsSocket(id) {
    return this[MAP_HTTPS_SOCKETS].get(id)
  }

  static async init(pushConfig) {
    if (_instance) return _instance

    _instance = new Context()

    const promises = []
    if (typeof pushConfig.https === 'object') {
      const { port, key, cert } = pushConfig.https
      if (parseInt(port) && fs.existsSync(key) && fs.existsSync(cert)) {
        const httpsServer = (await import('https')).createServer({
          key: fs.readFileSync(key, 'utf8').toString(),
          cert: fs.readFileSync(cert, 'utf8').toString(),
        })
        const { Server } = await import('socket.io')
        const io = new Server(httpsServer)
        const p = new Promise((resolve, reject) => {
          httpsServer.listen(port, () => {
            logger.info(`完成启动推送服务https端口：${port}`)
            io.on('connection', (socket) => {
              _instance[MAP_HTTPS_SOCKETS].set(socket.id, socket)
              socket.emit('tms-koa-push', { status: 'connected' })
            })
            resolve('ok')
          })
          httpsServer.on('error', (err) => {
            if (err) {
              logger.error(`启动推送服务https端口【${port}】失败: `, err)
              reject(err)
            }
          })
        })
        promises.push(p)
      }
    }
    if (parseInt(pushConfig.port)) {
      const httpServer = (await import('http')).createServer()
      const { Server } = await import('socket.io')
      const io = new Server(httpServer)
      const p = new Promise((resolve) => {
        httpServer.listen(pushConfig.port, () => {
          logger.info(`完成推送服务启动，开始监听端口：${pushConfig.port}`)
          io.on('connection', (socket) => {
            _instance[MAP_SOCKETS].set(socket.id, socket)
            socket.emit('tms-koa-push', { status: 'connected' })
          })
          resolve('ok')
        })
      })
      promises.push(p)
    }
    if (promises.length) return Promise.all(promises).then(() => _instance)
    else return null
  }

  static ins = Context.init
}
