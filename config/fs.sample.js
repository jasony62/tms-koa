const schemas = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  title: 'Json-Doc-File',
  description: 'tms-koa file',
  properties: {
    comment: {
      type: 'string',
      minLength: 0,
      maxLength: 80,
      title: '备注',
      attrs: {
        placeholder: '请输入备注',
        title: '备注'
      }
    }
  }
}
const database = {
  dialect: 'mongodb',
  source: 'master',
  database: 'upload',
  file_collection: 'files'
}

module.exports = {
  local: {
    rootDir: '', // 上传文件存储的起始位置
    outDir: '', // 系统生成文件存储的起始位置
    domains: {
      upload: {
        database,
        schemas,
        customName: false, // 是否保留上传文件名和指定的目录
        bucket: {
          module: ''
        },
        accessControl: {
          module: '' // 返回检查函数的模块地址
        }
      }
    },
    defaultDomain: 'upload'
  }
}
