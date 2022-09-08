const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-koa-agenda')
const Agenda = require('agenda')
const MongoContext = require('./mongodb').Context
const path = require('path')
const glob = require('glob')
const Debug = require('debug')

const debug = Debug('tms-koa:agenda:context')

/**
 * 任务调度服务上下文
 */
export class Context {
  /**
   * 上下文实例
   */
  private static instance
  /**
   *
   */
  private _agenda
  constructor(agenda) {
    this._agenda = agenda
  }
  get agenda() {
    return this._agenda
  }
  /**
   *
   * @param config
   */
  static async init(config: any) {
    if (Context.instance) return Context.instance
    if (!config || typeof config !== 'object') {
      let msg = '没有指定连接agenda配置信息'
      logger.error(msg)
      throw Error(msg)
    }
    if (config['diabled'] === true) {
      return {}
    }
    const { mongodb, jobDir } = config
    if (!mongodb || typeof mongodb !== 'object') {
      let msg = '没有指定agenda服务的mongodb数据源'
      logger.error(msg)
      throw Error(msg)
    }
    const { source, database, collection } = mongodb
    const mongoClient = await MongoContext.mongoClient(source)
    if (!mongoClient) {
      let msg = `agenda服务指定的mongodb数据源【${source}】不存在`
      logger.error(msg)
      throw Error(msg)
    }
    if (!database || typeof database !== 'string') {
      let msg = `没有给agenda服务指定有效的数据库名称`
      logger.error(msg)
      throw Error(msg)
    }
    if (!collection || typeof collection !== 'string') {
      let msg = `没有给agenda服务指定有效的集合名称`
      logger.error(msg)
      throw Error(msg)
    }

    let agenda
    try {
      agenda = new Agenda({ mongo: mongoClient.db(database) })
    } catch (e) {
      console.log(e)
    }

    Context.instance = new Context(agenda)

    const jobs = []
    if (jobDir && typeof jobDir === 'string') {
      debug(`指定了agenda任务文件目录：${jobDir}`)
      const dirAry = jobDir.split(',')
      logger.info(`读取插件配置[${dirAry}]`)
      dirAry.forEach(async (dir) => {
        dir = dir.trim()
        if (dir === '') return
        let absDir = path.resolve(process.cwd(), dir)
        logger.info(`从目录[${absDir}]读取agenda任务文件`)
        let files: string[] = glob.sync(`${absDir}/*.js`)
        for (let file of files) {
          let { plan, createJob } = require(file)
          if (!plan || typeof plan !== 'object') {
            logger.warn(`agenda任务文件[${file}]不可用，没有导出[plan]对象`)
            continue
          }
          let { name, interval } = plan
          if (!name || typeof name !== 'string') {
            logger.warn(`agenda任务文件[${file}]中，[plan.name]字段不可用`)
            continue
          }
          if (!interval || typeof interval !== 'string') {
            logger.warn(`agenda任务文件[${file}]中，[plan.interval]字段不可用`)
            continue
          }
          if (typeof createJob !== 'function') {
            logger.warn(`agenda任务文件[${file}]没有导出[createJob]方法`)
            continue
          }
          await createJob(agenda)
          // 记录要执行的调度任务
          debug(`加载agenda任务【name=${name},interval=${interval}】`)
          jobs.push({ name, interval })
        }
      })
    }

    try {
      await agenda.start()
    } catch (e) {
      console.log(e)
    }
    logger.info(`完成agenda服务设置`)

    agenda.on('start', (job) => {
      let msg = `agenda任务【${job.attrs.name}】开始执行`
      debug(msg)
      logger.debug(msg)
    })

    agenda.on('complete', (job) => {
      let msg = `agenda任务【${job.attrs.name}】完成执行`
      debug(msg)
      logger.debug(msg)
    })

    if (jobs.length) {
      for (let job of jobs) {
        await agenda.every(job.interval, job.name)
        debug(`启动agenda任务【name=${job.name},interval=${job.interval}】`)
      }
    }

    return Context.instance
  }
}
