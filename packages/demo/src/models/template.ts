import { DbModel } from 'tms-koa'

export class Template extends DbModel {
  constructor({ debug = false } = {}) {
    super('template', { debug })
  }
}

export const create = Template.create.bind(Template)
