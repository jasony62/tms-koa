module.exports = {
  collectDefault: false, // 是否包含默认系统监控指标
  systemProfile: {
    db: 'mydb',
    prefix: 'tms', // 指标前缀
  }, // 对象或数组，指定一个要监控的system.profile集合
}
