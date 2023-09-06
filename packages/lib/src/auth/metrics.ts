import { Context } from '../app.js'
const { MetricsContext } = Context

const Prefix = 'tmskoa'

export class Metrics {
  totalCounter
  timeCounter
  constructor() {
    let promClient = MetricsContext.insSync().client

    this.totalCounter = new promClient.Counter({
      name: Prefix + '_router_auth_total',
      help: '认证路由调用次数',
      labelNames: ['name', 'stage'] as const,
    })

    this.timeCounter = new promClient.Counter({
      name: Prefix + '_router_auth_time',
      help: '认证路由调用耗时',
      labelNames: ['name', 'stage'] as const,
    })
  }
  // 请求次数
  total(labels: any) {
    this.totalCounter.inc(labels)
  }
  // 请求花费时间
  time(labels: any, val: number) {
    this.timeCounter.inc(labels, val)
  }
}
