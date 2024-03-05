/**
 * 认证服务账号管理相关配置
 */
export interface AuthConfigClientInf {
  /**
   * 获取
   * @param ctx
   * @returns
   */
  createTmsClient: (ctx: any) => {}
  /**
   * 客户端注册方法
   * @param ctx
   * @returns
   */
  registerTmsClient?: (ctx: any) => {}
  /**
   * 服务本地账号
   */
  accounts?: any[]
}
/**
 * 认证服务验证码相关配置
 */
export interface AuthConfigCaptchaInf {
  /**
   * 停用验证码？
   */
  disabled: boolean
  /**
   *
   * npm/path/code
   */
  mode: string
  /**
   * 固定的验证码
   */
  code?: string
  /**
   * 创建验证码方法
   * @param ctx
   * @returns
   */
  createCaptcha: (ctx: any) => {}
  /**
   * 检查验证码
   * @param ctx
   * @returns
   */
  checkCaptcha: (ctx: any) => {}
}
/**
 * 认证服务配置
 */
export interface AuthConfigInf {
  mode: string
  jwt?: any
  redis?: any
  client: AuthConfigClientInf
  captcha?: Partial<AuthConfigCaptchaInf>
}
