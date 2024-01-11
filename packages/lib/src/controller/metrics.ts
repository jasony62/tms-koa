import { Context } from '../app.js'
const { MetricsContext } = Context

const Prefix = 'tmskoa'

export class Metrics {
  totalCounter
  timeCounter
  constructor() {
    if (MetricsContext) {
      let promClient = MetricsContext.insSync().client

      this.totalCounter = new promClient.Counter({
        name: Prefix + '_router_controllers_total',
        help: '控制器路由调用次数',
        labelNames: ['url', 'stage', 'ctrlName', 'ctrlMethod'] as const,
      })

      this.timeCounter = new promClient.Counter({
        name: Prefix + '_router_controllers_time',
        help: '控制器路由调用耗时',
        labelNames: ['url', 'stage', 'ctrlName', 'ctrlMethod'] as const,
      })
    }
  }
  // 请求次数
  total(labels: any) {
    if (MetricsContext) {
      this.totalCounter.inc(labels)
    }
  }
  // 请求花费时间
  time(labels: any, val: number) {
    if (MetricsContext) {
      this.timeCounter.inc(labels, val)
    }
  }
}
