const _ = require('lodash')
const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-koa-swagger')
const Router = require('koa-router')
const swaggerJSDoc = require('swagger-jsdoc')

const { AppContext, SwaggerContext } = require('../app').Context

let prefix = _.get(
  AppContext.insSync(),
  ['router', 'swagger', 'prefix'],
  '/oas'
)
if (prefix && !/^\//.test(prefix)) prefix = `/${prefix}`

let msg = `启用Swagger服务，地址前缀：${prefix}。`
logger.info(msg)

const router = new Router()

/** 获得API定义 */
const getSpec = (() => {
  const swaggerConfig = SwaggerContext.insSync()
  let spec

  return function (refresh = false) {
    if (!refresh && spec) return spec

    const { definition, apis } = swaggerConfig
    const options = {
      definition,
      apis,
    }

    spec = swaggerJSDoc(options)

    return spec
  }
})()

router.get(prefix, (ctx) => {
  let { request, response } = ctx
  let { refresh } = request.query

  refresh = /Y/i.test(refresh)

  response.body = getSpec(refresh)
})

module.exports = router
