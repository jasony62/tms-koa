const { Client } = require('tms-koa')
/**
 * 根据http请求中包含的信息获得用户数据，支持异步调用
 */
module.exports = function (ctx) {
  const { userid, name } = ctx.request.body

  let tmsClient = new Client(userid, { userid, name })

  return Promise.resolve([true, tmsClient])
}
