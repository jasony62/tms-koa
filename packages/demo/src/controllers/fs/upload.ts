import { UploadCtrl } from 'tms-koa/dist/controller/fs/upload.js'

export class Upload extends UploadCtrl {
  static tmsAccessWhite() {
    return ['plain']
  }
}

export default Upload
