module.exports = {
  appenders: {
    consoleout: { type: 'stdout' },
  },
  categories: {
    default: { appenders: ['consoleout'], level: 'info' },
  },
  pm2: true,
}
