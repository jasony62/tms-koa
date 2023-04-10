import { BaseCtrl } from './base'
import { ResultData, ResultFault } from '../../response'

import { Info } from '../../model/fs'

/**
 * 文件管理控制器
 */
export class BrowseCtrl extends BaseCtrl {
  /**
   * 文件的业务信息
   *
   * @param {string} path
   */
  async getBizInfo(path) {
    const fsInfo = await Info.ins(this.domain)
    if (!fsInfo) return new ResultFault('不支持设置文件信息')

    const info = await fsInfo.get(path)

    if (info) delete info.path

    return info
  }
  /**
   * 返回文件列表
   */
  async list() {
    let { dir } = this.request.query
    let tmsFS = this.fsModel()
    let { files, dirs } = await tmsFS.list(dir, 1)

    /**
     * 合并在数据库中保存的信息
     */
    const fsInfoModel = await Info.ins(this.domain)
    if (fsInfoModel) {
      for (let i = 0, l = files.length; i < l; i++) {
        let file = files[i]
        let info = await fsInfoModel.get(file.path)
        if (info) {
          delete info._id
          delete info.path
          Object.assign(file, info)
        }
      }
    }

    return new ResultData({ files, dirs })
  }
}
