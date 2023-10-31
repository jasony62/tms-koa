let counter = 0

function createJob(agenda) {
  console.log('Create agenda job 健康报告')
  agenda.define('健康报告', async (job) => {
    console.log(
      `-------------\n第【${++counter}】次报告健康报告\n----------------`
    )
  })
}

const plan = {
  name: '健康报告',
  interval: '1 minutes',
}

export { plan, createJob }
