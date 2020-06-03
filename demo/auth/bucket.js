/**
 * bucket验证函数
 */
module.exports = function (client, request) {
  const { bucket } = request.query

  if (bucket) return [true, bucket]

  return [false]
}
