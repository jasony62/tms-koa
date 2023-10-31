import { getLogger } from '@log4js-node/log4js-api'
import { Ctrl, ResultData, ResultFault } from 'tms-koa'
import { buildUrlWithQuery } from './util.js'

const logger = getLogger('tms-koa-agenda')
/**
 * 执行任务
 *
 * @param job
 * @returns
 */
const runHttpJon = async (job) => {
  const { data } = job.attrs
  if (!data || typeof data !== 'object') {
    logger.warn(`执行任务【${name}】是没有提供参数【data】`)
    return
  }

  const { url, method, headers, query, body, callback } = data
  if (!url || typeof url !== 'string') {
    logger.warn(`执行任务【${name}】的参数中没有指定有效的【url】参数`)
    return
  }
  /**
   * 执行任务
   */
  const uri = buildUrlWithQuery({ url, query })
  const options = {
    method: method ?? 'GET',
    body: JSON.stringify(body),
    headers: headers ?? {},
  }
  const request = new Request(uri, options)
  const { status, statusText } = await fetch(request)
  logger.debug(
    `执行任务【${name}】响应状态status=${status}, statusText=${statusText}`
  )
  const result = await request.json()
  /**
   * 执行回调
   */
  if (callback && typeof callback === 'object') {
    const { url, method } = callback
    const options = {
      method: method ?? 'POST',
      body: JSON.stringify({ result }),
    }
    const request = new Request(url, options)
    const { status, statusText } = await fetch(request)
    logger.debug(
      `执行任务【${name}】的回调请求响应状态status=${status}, statusText=${statusText}`
    )
  }
}
/**
 * 管理调度任务
 */
export class Admin extends Ctrl {
  /**
   * 调度服务实例
   */
  agenda

  get posted() {
    return this.request.body
  }
  /**
   * 支持白名单访问
   * @returns
   */
  static tmsAuthTrustedHosts() {
    return true
  }

  async tmsBeforeEach(): Promise<ResultFault | true> {
    const { AgendaContext } = this.tmsContext
    if (!AgendaContext) return new ResultFault('没有开启调度服务')

    const { agenda } = await AgendaContext.ins()
    if (!agenda) return new ResultFault('没有可用的调度服务实例')

    this.agenda = agenda

    return true
  }
  /**
   * 任务列表
   */
  async list() {
    return new ResultData('list')
  }
  /**
   * 定义任务
   */
  async define() {
    const { name } = this.posted
    // 定义任务
    this.agenda.define(name, runHttpJon)

    return new ResultData('ok')
  }
  /**
   * 立即执行一次
   * @returns
   */
  async now() {
    const { name, data } = this.posted
    if (this.agenda._definitions[name] ?? true) {
      this.agenda.define(name, runHttpJon)
    }
    this.agenda.now(name, data)

    return new ResultData('ok')
  }
  /**
   * 周期执行
   * @returns
   */
  async every() {
    const { name, interval, data } = this.posted
    if (this.agenda._definitions[name] ?? true) {
      this.agenda.define(name, runHttpJon)
    }
    this.agenda.every(interval, name, data)

    return new ResultData('ok')
  }
  /**
   * 指定时间执行
   * @returns
   */
  async schedule() {
    const { name, when, data } = this.posted
    if (this.agenda._definitions[name] ?? true) {
      this.agenda.define(name, runHttpJon)
    }
    this.agenda.schedule(when, name, data)

    return new ResultData('ok')
  }
  /**
   *
   * @returns
   */
  async disable() {
    const { name } = this.posted

    this.agenda.disable({ name })

    return new ResultData('ok')
  }
  /**
   *
   * @returns
   */
  async enable() {
    const { name } = this.posted

    this.agenda.enable({ name })

    return new ResultData('ok')
  }
  /**
   * 取消任务
   */
  async cancel() {
    const { name } = this.posted

    this.agenda.cancel({ name })

    return new ResultData('cancel')
  }
  /**
   *
   * @returns
   */
  async purge() {
    return new ResultData('ok')
  }
}

export default Admin
