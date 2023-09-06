import { loadConfig } from 'tms-koa'

const AccountConfig = await loadConfig('account', {})

export { AccountConfig }
