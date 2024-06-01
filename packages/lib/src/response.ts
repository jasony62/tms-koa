/**
 * Ctrl返回结果
 */
export class ResultBase {
  msg: string
  code: number
  result: any

  constructor(result, msg, code) {
    this.msg = msg
    this.code = code
    if (result !== undefined && result !== null) this.result = result
  }
}
export class ResultData extends ResultBase {
  constructor(result = null, msg = '正常', code = 0) {
    super(result, msg, code)
  }
}
/**
 * 一般错误
 * 前2位编码从10开始
 */
export class ResultFault extends ResultBase {
  constructor(msg = '操作无法完成', code = 10001, result = null) {
    super(result, msg, code)
  }
}
export class ResultObjectNotFound extends ResultFault {
  constructor(msg = '指定的对象不存在', result = null, code = 10002) {
    super(msg, code, result)
  }
}
/**
 * access_token失败
 * 前2位编码从20开始
 */
export class AccessTokenFault extends ResultBase {
  constructor(msg = '', code = 20001, result = null) {
    super(result, msg, code)
  }
}
/**
 * SSE方式返回结果
 */
export class ResultSSE extends ResultBase {
  constructor(msg = 'SSE方式返回结果', code = 10101, result = null) {
    super(result, msg, code)
  }
}
