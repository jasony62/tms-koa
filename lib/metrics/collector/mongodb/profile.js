const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-koa-metrics')
const { Counter } = require('prom-client')

/* 获取数据 */
async function fetch(client, dbName, beforeLatestTs) {
  const db = await client.db(dbName)
  let docs = await db
    .collection('system.profile')
    .find(
      { ts: { $gt: beforeLatestTs }, ns: { $not: /system.profile/ } },
      { ns: 1, ts: 1, millis: 1 }
    )
    .toArray()

  let mapNsData = new Map()
  let latestTs = beforeLatestTs
  if (docs && docs.length > 0) {
    latestTs = docs[docs.length - 1]['ts']
    docs.forEach((doc) => {
      let nsData = mapNsData.get(doc.ns)
      if (!nsData) {
        nsData = { millis: 0, total: 0 }
        mapNsData.set(doc.ns, nsData)
      }
      nsData.millis += doc.millis
      nsData.total++
    })
  }

  return { latestTs, data: mapNsData }
}
/* 实现一个时间只取一次*/
const OnlyOnceFetch = {
  latestTs: -1,
  latestPromise: null,
  run: async (host) => {
    if (host.latestTs != this.latestTs) {
      this.latestPromise = new Promise(async (resolve) => {
        let result = await fetch(host.client, host.dbName, host.latestTs)
        host.latestTs = new Date(result.latestTs)
        resolve(result)
      })
      this.latestTs = host.latestTs
    }
    return this.latestPromise
  },
}

/**
 * 从system.profile集合中收集监控指标
 */
class ProfileCollector {
  constructor(client, dbName, prefix) {
    this.client = client
    this.dbName = dbName
    this.prefix = prefix
    this.latestTs = new Date(0)
  }

  async run() {
    const MetricsContext = require('../../../context/metrics').Context
    const metricsContext = MetricsContext.insSync()

    let prefix = this.prefix ? this.prefix : 'tms'
    const total = new Counter({
      name: `${prefix}_mongodb_system_profile_total`,
      help: '慢查询累积发生的次数',
      labelNames: ['ns'],
      registers: [metricsContext.register],
      collect: async () => {
        await OnlyOnceFetch.run(this).then((result) => {
          result.data.forEach((nsData, ns) => {
            total.labels({ ns }).inc(nsData.total)
          })
        })
      },
    })
    const mills = new Counter({
      name: `${prefix}_mongodb_system_profile_millis`,
      help: '慢查询累积执行的时间',
      labelNames: ['ns'],
      registers: [metricsContext.register],
      collect: async () => {
        await OnlyOnceFetch.run(this).then((result) => {
          result.data.forEach((nsData, ns) => {
            mills.labels({ ns }).inc(nsData.millis)
          })
        })
      },
    })
  }
}

module.exports = { ProfileCollector }
