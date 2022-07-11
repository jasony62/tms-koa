const { Ctrl, ResultData } = require('tms-koa')

class Main extends Ctrl {
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
    console.log(`tryGet: bucket=${bucket}`)

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
}
module.exports = Main
