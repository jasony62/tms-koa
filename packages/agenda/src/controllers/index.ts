import { getLogger } from '@log4js-node/log4js-api'
import { Ctrl, ResultData, ResultFault } from 'tms-koa'
import { buildUrlWithQuery } from './util.js'

const logger = getLogger('tms-koa-agenda')
/**
 * 指定任务的命名空间，用于与其它任务区分
 */
const JOB_HTTP_NAMESPACE =
  process.env.TMS_KOA_AGENDA_HTTP_JOB_NAMESPACE || 'tms-koa-agenda:http-job:'

function nsname(name: string) {
  return `${JOB_HTTP_NAMESPACE}${name}`
}
/**
 * 执行任务
 *
 * @param job
 * @returns
 */
const runHttpJob = async (job) => {
  const { name, data } = job.attrs
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

  try {
    const request = new Request(uri, options)
    const response = await fetch(request)
    const { status, statusText, headers: rspHeaders } = response
    logger.debug(
      `执行任务【${name}】响应状态status=${status}, statusText=${statusText}`
    )
    const contentType = rspHeaders.get('content-type')
    const result = /^application\/json/i.test(contentType)
      ? await response.json()
      : await response.text()
    logger.debug(`任务【${name}】执行结果`, result)
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
  } catch (e) {
    console.error('[tms-koa-agent] 执行HTTP调用发生异常', e)
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
  /**
   * 启动服务
   * 恢复保存的任务
   *
   * @param AgendaContext
   */
  static async startup(AgendaContext) {
    logger.info(`启动服务`)
    if (!AgendaContext) {
      logger.warn('没有开启调度服务，无法启动')
      return
    }
    const { agenda } = await AgendaContext.ins()
    if (!agenda) {
      logger.warn('没有可用的调度服务实例，无法启动')
      return
    }
    const query = {
      name: { $regex: new RegExp(`^${JOB_HTTP_NAMESPACE}`) },
      nextRunAt: { $ne: null },
    }
    const jobs: any[] = await agenda.jobs(query)
    let counter = 0
    for (let job of jobs) {
      logger.debug(`恢复任务`, job.toJSON())
      agenda.define(job.attrs.name, runHttpJob)
      counter++
    }
    logger.info(`恢复了${counter}个任务`)

    return counter
  }
  /**
   *
   * @returns
   */
  _jobNsName() {
    return nsname(this.posted.name)
  }
  /**
   *
   * @returns
   */
  async tmsBeforeEach(): Promise<ResultFault | true> {
    const { AgendaContext } = this.tmsContext
    if (!AgendaContext) return new ResultFault('没有开启调度服务')

    const { agenda } = await AgendaContext.ins()
    if (!agenda) return new ResultFault('没有可用的调度服务实例')

    this.agenda = agenda

    return true
  }
  /**
   * 恢复数据库中的任务
   *
   * @returns
   */
  async restore() {
    const jobNum = await Admin.startup(this.tmsContext.AgendaContext)
    return new ResultData(jobNum)
  }
  /**
   * 任务列表
   */
  async list() {
    const name = this._jobNsName()
    const { disabled, finished, filter } = this.posted
    /**
     * 构造查询提交
     */
    const query: any = Object.assign(
      {},
      filter && typeof filter === 'object' ? filter : {},
      { name }
    )
    /**
     * 任务是否已经完成
     * 根据nextRunAt字段判断
     */
    if (finished !== null && finished !== undefined) {
      if (finished === true) query.nextRunAt = null
      else if (finished === false) query.nextRunAt = { $ne: null }
    }

    // 是否禁用
    if (disabled === true) {
      query.disabled = true
    }

    const jobs = await this.agenda.jobs(query)

    return new ResultData(jobs)
  }
  /**
   * 定义任务
   */
  async define() {
    const name = this._jobNsName()
    // 定义任务
    this.agenda.define(name, runHttpJob)

    return new ResultData('ok')
  }
  /**
   * 立即执行一次
   */
  async now() {
    const name = this._jobNsName()
    const { data } = this.posted

    if (this.agenda._definitions[name] ?? true) {
      this.agenda.define(name, runHttpJob)
    }

    this.agenda.now(name, data)

    return new ResultData('ok')
  }
  /**
   * 周期执行
   * @returns
   */
  async every() {
    const name = this._jobNsName()
    const { interval, data } = this.posted

    if (this.agenda._definitions[name] ?? true) {
      this.agenda.define(name, runHttpJob)
    }

    this.agenda.every(interval, name, data)

    return new ResultData('ok')
  }
  /**
   * 指定时间执行
   * @returns
   */
  async schedule() {
    const name = this._jobNsName()
    const { when, data } = this.posted

    if (this.agenda._definitions[name] ?? true) {
      this.agenda.define(name, runHttpJob)
    }

    this.agenda.schedule(when, name, data)

    return new ResultData('ok')
  }
  /**
   *
   * @returns
   */
  async disable() {
    const name = this._jobNsName()

    this.agenda.disable({ name })

    return new ResultData('ok')
  }
  /**
   *
   * @returns
   */
  async enable() {
    const name = this._jobNsName()

    this.agenda.enable({ name })

    return new ResultData('ok')
  }
  /**
   * 删除任务
   */
  async cancel() {
    const name = this._jobNsName()

    const numRemoved = this.agenda.cancel({ name })

    return new ResultData(numRemoved)
  }
  /**
   * 清除所有没有任务定义的任务
   *
   * @returns
   */
  async purge() {
    const numRemoved = await this.agenda.purge()

    return new ResultData(numRemoved)
  }
}

export default Admin
