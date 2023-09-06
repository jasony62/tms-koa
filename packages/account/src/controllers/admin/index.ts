import { Ctrl, ResultData, ResultFault } from 'tms-koa'
import { createModel } from '../../models/store/index.js'

/**
 * 管理系统账号
 */
export class Admin extends Ctrl {
  async tmsBeforeEach(): Promise<ResultFault | true> {
    if (!this.client || this.client.isAdmin !== true)
      return new ResultFault('只有管理员账号可进行该操作')
  }
  /**
   * 账号列表
   */
  async list() {
    let { page, size } = this.request.query
    const { filter } = this.request.body
    const Model = createModel(this.tmsContext)
    const result = await Model.list({ filter }, { page, size })

    return new ResultData(result)
  }
  /**
   * 创建新账号
   */
  async create() {
    let userInfo = this.request.body
    const Model = createModel(this.tmsContext)
    return Model.processAndCreate(userInfo)
      .then((account) => {
        return new ResultData(account)
      })
      .catch((errMsg) => {
        return new ResultFault(errMsg)
      })
  }
  /**
   * 禁用账号
   */
  async forbid() {
    const { id } = this.request.query
    const Model = createModel(this.tmsContext)
    const result = await Model.forbid(id)
    return new ResultData(result)
  }
  /**
   * 解禁账号
   */
  async unforbid() {
    const { id } = this.request.query
    const Model = createModel(this.tmsContext)
    const result = await Model.unforbid(id)
    return new ResultData(result)
  }
}

export default Admin
