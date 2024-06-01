import { Ctrl, ResultData } from 'tms-koa'
import { ResultSSE } from 'tms-koa/dist/response.js'

export class Main extends Ctrl {
  /**
   * @swagger
   *
   *  /tryGet:
   *    get:
   *      description: 测试get方法，传入参数，并返回结果
   *      parameters:
   *        - name: value
   *          description: 传入1个值
   *          in: query
   *          required: false
   *          schema:
   *            type: string
   *      responses:
   *        '200':
   *          description: 将输入的值作为执行结果返回
   *          content:
   *            application/json:
   *              schema:
   *                type: object
   *                properties:
   *                  code:
   *                    type: integer
   *                  msg:
   *                    type: string
   *                  result:
   *                    type: string
   */
  tryGet() {
    let { value } = this.request.query
    const { bucket } = this
    console.log(`tryGet: bucket=${bucket},value=${value}`)

    return new ResultData(`收到：${value}`)
  }
  /**
   * @swagger
   *
   *  /tryPost:
   *    post:
   *      description: 测试post方法，传入参数，并返回结果
   *      requestBody:
   *        content:
   *          application/json:
   *            schema:
   *              type: object
   *        required: true
   *      responses:
   *        '200':
   *          description: 将输入的值作为执行结果返回
   *          content:
   *            application/json:
   *              schema:
   *                type: object
   *                properties:
   *                  code:
   *                    type: integer
   *                  msg:
   *                    type: string
   *                  result:
   *                    type: object
   *
   */
  tryPost() {
    let posted = this.request.body

    const { bucket } = this
    console.log(`tryPost: bucket=${bucket},posted=${JSON.stringify(posted)}`)

    return new ResultData(posted)
  }
  /**
   * @swagger
   *
   * /tryPush:
   *   get:
   *     description: 测试push方法
   *     responses:
   *       200:
   *         description: 返回ok
   */
  tryPush() {
    if (this.socket) {
      setTimeout(() => {
        this.socket.emit('tms-koa-controller', { result: 'push in tryPush()' })
      }, 1000)
    }
    return new ResultData('ok')
  }
  async trySse() {
    const { ctx } = this
    ctx.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })

    let counter = 0
    const { PassThrough } = await import('stream')
    const stream = new PassThrough()
    ctx.status = 200
    ctx.body = stream

    const timer = setInterval(() => {
      counter++
      stream.write(`data:[${counter}] - ${new Date()}\n\n`)
      if (counter === 10) {
        clearInterval(timer)
        stream.end('data:end')
      }
    }, 200)

    return new ResultSSE()
  }
}

export default Main
