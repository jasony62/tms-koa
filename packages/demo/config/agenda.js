module.exports = {
  mongodb: {
    source: 'master',
    database: 'agenda',
    collection: 'agendaJobs',
  },
  jobDir: 'jobs/**', // 逗号分隔，支持glob格式
}
