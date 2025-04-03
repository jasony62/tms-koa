import { BaseCtrl } from './base.js'
import { ResultData, ResultFault } from '../../response.js'
import { UploadPlain, Info } from '../../model/fs/index.js'
import * as fs from 'fs'
import type { File } from 'formidable'

/**
 * 检查上传文件的类型
 *
 * @param fsContext
 * @param mimetype
 * @returns
 */
function checkMimeType(fsContext: any, mimetype: string) {
  const { accept } = fsContext
  // 未指定限制规则
  if (!Array.isArray(accept) || accept.length === 0) return true
  // 查找匹配的规则
  if (accept.find((at) => new RegExp(at).test(mimetype))) return true

  return false
}

/**
 * 文件管理控制器（上传）
 */
export class UploadCtrl extends BaseCtrl {
  /**
   * 表单方式上传单个文件
   * 上传文件时需要检查文件的类型，避免任意文件上传
   */
  async plain() {
    if (!this.request.files?.file) return new ResultFault('没有上传文件')

    // 指定的文件存储目录，如果不指定按时间自动生成目录
    const { dir, forceReplace, thumb, name } = this.request.query
    // 上传的原始文件，由formidable定义
    const { file }: { file: File } = this.request.files
    // 改为用户指定的名称
    if (name) {
      const oType = file.originalFilename.split('.').slice(-1)[0]
      const nType = name.split('.').slice(-1)[0]
      if (oType !== nType) return new ResultFault('不允许改变文件扩展名')
      file.originalFilename = name
    }
    const { mimetype } = file
    if (!checkMimeType(this.fsContext, mimetype)) {
      return new ResultFault(`不支持上传的文件类型[${mimetype}]`)
    }

    const tmsFs = this.fsModel()
    const uploader = new UploadPlain(tmsFs)
    try {
      const filepath = await uploader.store(file, dir, forceReplace)
      let thumbInfo
      if (thumb === 'Y' && this.fsContext.backService === 'local') {
        if (
          this.fsContext?.thumbnail &&
          typeof this.fsContext.thumbnail === 'object'
        ) {
          thumbInfo = await uploader.makeThumb(filepath)
        } else {
          return new ResultFault('未设置缩略图服务，无法创建缩略图')
        }
      }

      let result: any = { path: filepath, size: file.size }
      if (thumbInfo) {
        result.thumbPath = thumbInfo.path
        result.thumbSize = thumbInfo.size
      }

      /**在数据库中记录文件信息*/
      const fsInfoModel = await Info.ins(this.domain)
      if (fsInfoModel) {
        // 支持通过表单传递简单类型
        const info = this.request.body
        info.userid = this.client ? this.client.id : ''
        info.bucket = this.bucketObj.name
        info.name = file.originalFilename
        info.type = file.mimetype
        info.size = file.size
        // info.lastModified = file.lastModifiedDate
        //   ? file.lastModifiedDate.getTime()
        //   : Date.now()
        info.lastModified = Date.now()
        if (thumbInfo) {
          info.thumbSize = thumbInfo.size
          info.thumbType = info.type
        }
        /**
         * 保存用户自定义的扩展信息
         * 传递数据必须是JSON格式
         */
        const { schemasRootName } = this.domain
        if (schemasRootName) {
          let extraInfo = this.request.files[schemasRootName]
          if (
            extraInfo &&
            (extraInfo.mimetype === 'application/json' ||
              /\.json$/.test(extraInfo.originalFilename))
          ) {
            let data = fs.readFileSync(extraInfo.filepath, 'utf-8')
            data = JSON.parse(data)
            info[schemasRootName] = data
          }
        }
        fsInfoModel.set(filepath, info)
      }

      return new ResultData(result)
    } catch (e) {
      return new ResultFault(e.message)
    }
  }
  /**
   * 从给定的url下载文件，保存到本地
   * 有安全风险，怎样才能保证下载的文件没问题？
   */
  // async storeUrl() {
  //   // 指定的文件存储目录，如果不指定按时间自动生成目录
  //   const { url, dir, name, forceReplace } = this.request.query

  //   if (!url) return new ResultFault('没有指定文件地址')

  //   const tmsFs = this.fsModel()
  //   const uploader = new UploadPlain(tmsFs)

  //   const result = await uploader.storeByUrl(url, dir, forceReplace, name)

  //   return new ResultData(result)
  // }
  /**
   * 删除指定的文件
   */
  async remove() {
    const { file } = this.request.query
    /**
     * 删除文件
     */
    const fsModel = this.fsModel()
    const result = await fsModel.remove(file)
    if (false === result[0]) return new ResultFault(result[1])
    /**
     * 删除info
     */
    const fsInfoModel = await Info.ins(fsModel.domain)
    if (fsInfoModel) {
      await fsInfoModel.remove(fsModel.bucket, file)
    }

    return new ResultData('ok')
  }
  /**
   * @swagger
   *
   * /file/upload/mkdir:
   *   get:
   *     tags:
   *       - upload
   *     summary: 在指定目录下创建目录
   *     parameters:
   *       - $ref: '#/components/parameters/domain'
   *       - $ref: '#/components/parameters/bucket'
   *       - $ref: '#/components/parameters/dir'
   *     responses:
   *       200:
   *         $ref: '#/components/responses/ResponseOK'
   *
   */
  async mkdir() {
    const { dir } = this.request.query
    const tmsFs = this.fsModel()
    const result = await tmsFs.mkdir(dir)
    if (false === result[0]) return new ResultFault(result[1])

    return new ResultData('ok')
  }
  /**
   * @swagger
   *
   * /file/upload/rmdir:
   *   get:
   *     tags:
   *       - upload
   *     summary: 在指定目录下删除目录
   *     parameters:
   *       - $ref: '#/components/parameters/domain'
   *       - $ref: '#/components/parameters/bucket'
   *       - $ref: '#/components/parameters/dir'
   *     responses:
   *       200:
   *         $ref: '#/components/responses/ResponseOK'
   *
   */
  async rmdir() {
    const { dir } = this.request.query
    const tmsFs = this.fsModel()
    const result = await tmsFs.rmdir(dir)
    if (false === result[0]) return new ResultFault(result[1])

    return new ResultData('ok')
  }
}

export default UploadCtrl
