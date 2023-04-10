import { BaseCtrl } from './base'
import { ResultData, ResultFault } from '../../response'
import { Info } from '../../model/fs'

/**
 * 文件管理控制器
 */
export class ManageCtrl extends BaseCtrl {
  /**
   *
   * @returns
   */
  async list() {
    const fsInfo = await Info.ins(this.domain)
    if (!fsInfo) return new ResultFault('不支持设置文件信息')

    const { bucket } = this
    const query: any = {}
    if (bucket) query.bucket = bucket
    const { batch } = this.request.query
    const [page, size] = batch.split(',', 2)
    const skip = (parseInt(page) - 1) * parseInt(size)
    const limit = parseInt(size)

    const result = await fsInfo.list(query, skip, limit)

    return new ResultData(result)
  }
}
