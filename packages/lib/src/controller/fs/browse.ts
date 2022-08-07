import { BaseCtrl } from './base'
import { ResultData, ResultFault } from '../../response'

const { LocalFS } = require('../../model/fs/local')
const { Info } = require('../../model/fs/info')

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
    let localFS = new LocalFS(this.tmsContext, this.domain, this.bucket)
    let { files, dirs } = localFS.list(dir)

    /**合并在数据库中保存的信息*/
    const fsInfo = await Info.ins(this.domain)
    if (fsInfo) {
      for (let i = 0, ii = files.length; i < ii; i++) {
        let file = files[i]
        let info = await fsInfo.get(file.path)
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
