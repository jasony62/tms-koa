const config = {
  disabled: false, // 可省略
  master: {
    host: '127.0.0.1',
    port: 6379,
    // password: "********",
  },
}

if (/yes|true/i.test(process.env.TMW_REDIS_CLUSTER)) {
  config.master.host = [
    process.env.TMS_REDIS_HOST_1 || '192.168.43.127',
    process.env.TMS_REDIS_HOST_2 || '192.168.43.127',
    process.env.TMS_REDIS_HOST_3 || '192.168.43.127',
    process.env.TMS_REDIS_HOST_4 || '192.168.43.127',
    process.env.TMS_REDIS_HOST_5 || '192.168.43.127',
    process.env.TMS_REDIS_HOST_6 || '192.168.43.127',
  ]
  config.master.port = [
    parseInt(process.env.TMS_REDIS_PORT_1) || 6381,
    parseInt(process.env.TMS_REDIS_PORT_2) || 6382,
    parseInt(process.env.TMS_REDIS_PORT_3) || 6383,
    parseInt(process.env.TMS_REDIS_PORT_4) || 6384,
    parseInt(process.env.TMS_REDIS_PORT_5) || 6385,
    parseInt(process.env.TMS_REDIS_PORT_6) || 6386,
  ]
  // config.master.password = [
  //   process.env.TMS_REDIS_PWD_1 || "********",
  //   process.env.TMS_REDIS_PWD_2 || "********",
  //   process.env.TMS_REDIS_PWD_3 || "********",
  //   process.env.TMS_REDIS_PWD_4 || "********",
  //   process.env.TMS_REDIS_PWD_5 || "********",
  //   process.env.TMS_REDIS_PWD_6 || "********",
  // ]
  // config.master.masterAuthPasswor = '********'
}

export default config
