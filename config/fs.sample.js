module.exports = {
  local: {
    rootDir: '', // 文件存储的起始位置
    database: {
      dialect: 'mongodb',
      source: 'master',
      database: 'upload',
      file_collection: 'files'
    },
    schemas: {
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
  }
}
