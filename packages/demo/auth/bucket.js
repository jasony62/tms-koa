/**
 * bucket验证函数
 */
module.exports = function (ctx, client) {
  const { bucket } = ctx.request.query

  if (bucket) return [true, bucket]

  return [false]
}
