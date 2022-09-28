let counter = 0

function createJob(agenda) {
  agenda.define('健康报告', async (job) => {
    console.log(`第【${++counter}】次报告健康报告`)
  })
}

module.exports = {
  plan: {
    name: '健康报告',
    interval: '1 minutes',
  },
  createJob,
}
