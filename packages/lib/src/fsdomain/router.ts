/**
 * 本地文件下载服务
 */
import path from 'path'
import _ from 'lodash'
import log4js from '@log4js-node/log4js-api'
import Router from '@koa/router'
import send from 'koa-send'
import { Context } from '../app.js'

const logger = log4js.getLogger('tms-koa-fsdomain')
const { AppContext, FsContext } = Context

const prefix = _.get(
  AppContext.insSync(),
  ['router', 'fsdomain', 'prefix'],
  'fsdomain'
)

let msg = `启用文件服务的下载服务，地址前缀：${prefix}。`
logger.info(msg)

const router = new Router({ prefix })

async function findDiskFile(ctx, next) {
  let accessDomain = false
  if (ctx.method === 'HEAD' || ctx.method === 'GET') {
    const filepath = decodeURIComponent(ctx.path.replace(prefix, ''))
    const fsConfig = FsContext.insSync()
    if (fsConfig.domains && typeof fsConfig.domains === 'object') {
      if (
        Object.keys(fsConfig.domains).some(
          (domain) => filepath.indexOf(`/${domain}`) === 0
        )
      )
        accessDomain = true
    }
    if (accessDomain) {
      try {
        const root = path.resolve(fsConfig.rootDir)
        if (ctx.request.query.download === 'Y') ctx.attachment(filepath)
        await send(ctx, filepath, { root })
      } catch (err) {
        if (err.status !== 404) {
          throw err
        }
      }
    }
  }

  if (!accessDomain) {
    await next()
  }
}

router.all('/(.*)', findDiskFile)

export { router }
