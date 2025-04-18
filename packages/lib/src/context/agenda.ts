import log4js from '@log4js-node/log4js-api'
import { Agenda } from 'agenda'
import path from 'path'
import { glob } from 'glob'

const logger = log4js.getLogger('tms-koa-agenda')

const MongoContext = (await import('./mongodb.js')).Context
/**
 * 上下文实例
 */
let _instance
/**
 * 任务调度服务上下文
 */
export class Context {
  /**
   *
   * @param _agenda
   */
  constructor(private _agenda: Agenda) {}

  get agenda() {
    return this._agenda
  }
  /**
   *
   * @param config
   */
  static async init(config: any) {
    if (_instance) return _instance
    if (!config || typeof config !== 'object') {
      let msg = '没有指定连接agenda配置信息'
      logger.error(msg)
      throw Error(msg)
    }
    if (config.diabled === true) {
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

    const agenda = new Agenda({
      mongo: mongoClient.db(database),
      disableAutoIndex: true,
    })

    _instance = new Context(agenda)

    const jobs = []
    if (jobDir && typeof jobDir === 'string') {
      logger.info(`指定了agenda任务文件目录：${jobDir}`)
      const dirAry = jobDir.split(',')
      logger.info(`读取插件配置[${dirAry}]`)
      for (let dir of dirAry) {
        dir = dir.trim()
        if (dir === '') return
        let absDir = path.resolve(process.cwd(), dir)
        logger.info(`从目录[${absDir}]读取agenda任务文件`)
        let files: string[] = glob.sync(`${absDir}/*.js`)
        for (let file of files) {
          logger.debug(`从文件【${file}】读取调度任务`)
          let { plan, createJob } = await import(file)
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
          logger.info(`加载agenda任务【name=${name},interval=${interval}】`)
          jobs.push({ name, interval })
        }
      }
    }
    agenda.on('ready', () => {
      logger.info('完成连接数据库')
    })
    agenda.on('error', () => {
      logger.error('连接mongodb失败')
    })
    agenda.on('start', (job) => {
      let msg = `任务【${job.attrs.name}】开始执行`
      logger.debug(msg)
    })
    agenda.on('complete', (job) => {
      let msg = `任务【${job.attrs.name}】完成执行`
      logger.debug(msg)
    })
    agenda.start()
    logger.info(`完成agenda服务设置`)

    if (jobs.length) {
      for (let job of jobs) {
        await agenda.every(job.interval, job.name)
        logger.debug(
          `启动agenda任务【name=${job.name},interval=${job.interval}】`
        )
      }
    }

    return _instance
  }

  static ins = Context.init
}
