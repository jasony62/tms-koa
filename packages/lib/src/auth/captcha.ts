/**
 * 传递调用鉴权接口所需的验证信息，例如：验证码
 */
export class Captcha {
  code
  constructor(code = '') {
    this.code = code
  }
}
