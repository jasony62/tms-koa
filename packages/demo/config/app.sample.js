export default {
  port: 3001,
  https: { port: 3002, key: '', cert: '' },
  name: 'tms-koa-0',
  router: {
    auth: {
      prefix: '',
      trustedHosts: [], // 允许访问的主机地址列表
    },
    controllers: {
      prefix: '',
      plugins_npm: [
        { id: 'tms-koa-account', dir: 'dist/controllers', alias: 'account' },
      ], // 指定npm包作为控制器
      excel: { outputDomain: 'upload' }, // 系统生成 excel文件 存放 默认域
    },
    fsdomian: {
      prefix: 'output',
    },
    swagger: {
      prefix: 'oas',
    },
  },
  auth: {
    captcha: {
      //path: '/auth/captcha.js', // 指定验证码实现方法
      //checkPath: '/auth/checkPath.js' // 指定检查验证码方法
      code: 'a1z9', // 预制验证码（没有指定外部实现方法时生效）
    },
    client: {
      //path: '/auth/client.js', // 指定用户认证实现方法
      //registerPath: "/auth/register.js" // 指定用户注册的实现方法
      accounts: [
        { id: 1, username: 'user1', password: '123456', bucket: ['bucket01'] },
      ], // 预制用户账号（没有指定外部实现方法时生效）
    },
    jwt: {
      privateKey: 'tms-koa-secret',
      expiresIn: 3600,
    },
    redis: {
      host: '127.0.0.1',
      port: 6379,
      password: '',
      expiresIn: 3600,
      prefix: 'tms-koa-0',
    },
    /* 指定的accesstoken */
    token: {
      local: { accesstoken01: { id: 'app01', isAdmin: false, data: {} } },
    },
    /* 检查bucket参数，支持多租户访问 */
    bucket: { validator: '' },
  },
  cors: {
    credentials: true,
  },
  body: {
    jsonLimit: '1mb',
    formLimit: '56kb',
    textLimit: '56kb',
    maxFileSize: '200mb', // 上传文件最大限制
  },
}
