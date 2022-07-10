const { DbModel } = require('tms-koa')

class Template extends DbModel {
  constructor({ db, debug = false } = {}) {
    super('template', { db, debug })
  }
}

module.exports = { Template, create: Template.create.bind(Template) }
