/**
 * 文件下载服务
 */
const path = require('path')
const _ = require('lodash')
const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-koa-fsdomain')
const Router = require('koa-router')
const send = require('koa-send')
const { AppContext, FsContext } = require('../app').Context

const prefix = _.get(AppContext.insSync(), ['router', 'fsdomain', 'prefix'], '')

if (prefix && prefix[0] !== '/') prefix = `/${prefix}`

let msg = `启用文件服务的下载服务`
if (prefix) msg += `，地址前缀：${prefix}`
msg += '。'
logger.info(msg)

const router = new Router({ prefix })

async function findDiskFile(ctx, next) {
  let accessDomain = false
  if (ctx.method === 'HEAD' || ctx.method === 'GET') {
    const filepath = ctx.path.replace(prefix, '')
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
        const opts = {}
        opts.root = path.resolve(fsConfig.rootDir)
        if (ctx.request.query.download === 'Y') ctx.attachment(filepath)
        await send(ctx, filepath, opts)
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

router.all('/*', findDiskFile)

module.exports = router
