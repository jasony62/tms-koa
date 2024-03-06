import { getLogger } from '@log4js-node/log4js-api'
const logger = getLogger('tms-koa-account')
/**
 * 使指定客户端的accessToken失效
 */
export function logoutTmsClient(tmsClient: any, access_token: string) {
  logger.debug('执行了登出方法')
}

export default logoutTmsClient
