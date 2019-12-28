module.exports = {
  port: 3001,
  name: 'tms-koa-0',
  router: {
    auth: {
      prefix: ''
    },
    controllers: {
      prefix: ''
    }
  },
  jwt: {
    privateKey: 'tms-koa-secret',
    expiresIn: 3600
  }
}
