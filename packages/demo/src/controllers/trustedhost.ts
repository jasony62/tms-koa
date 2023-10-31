import { Ctrl, ResultData, ResultFault } from 'tms-koa/dist/index.js'

export class Main extends Ctrl {
  tmsBeforeEach?(method: string): Promise<true | ResultFault> {
    return Promise.resolve(true)
  }
  /**
   * 检查请求是否来源于可信主机，跳过鉴权机制
   */
  static tmsAuthTrustedHosts() {
    return true
  }
  tryGet() {
    let { value } = this.request.query

    return new ResultData(`收到：${value}`)
  }
}

export default Main
