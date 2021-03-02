module.exports = {
  port: 3001,
  https: { port: 3002, key: '', cert: '' },
  name: 'tms-koa-0',
  router: {
    auth: {
      prefix: '',
    },
    controllers: {
      prefix: '',
      plugins_npm: [{ id: 'tms-koa-ffmpeg', alias: 'ffmpeg' }], // 指定npm包作为控制器
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
      code: 'a1z9', // 预制验证码（没有指定外部实现方法时生效）
    },
    client: {
      //path: '/auth/client.js', // 指定用户认证实现方法
      accounts: [{ id: 1, username: 'user1', password: '123456' }], // 预制用户账号（没有指定外部实现方法时生效）
    },
    jwt: {
      privateKey: 'tms-koa-secret',
      expiresIn: 3600,
    },
    redis: {
      host: '127.0.0.1',
      port: 6379,
      expiresIn: 3600,
      prefix: 'tms-koa-0',
    },
    /* 检查bucket参数，支持多租户访问 */
    bucket: { validator: '' },
  },
  cors: {
    credentials: true,
  },
  body: {
    jsonLimit: "1mb",
    formLimit: "56kb",
    textLimit: "56kb",
  },
}
