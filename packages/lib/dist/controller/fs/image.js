"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImageCtrl = void 0;
const upload_1 = require("./upload");
const response_1 = require("../../response");
const { LocalFS } = require('../../model/fs/local');
const { Info } = require('../../model/fs/info');
const { UploadImage } = require('../../model/fs/upload');
const fs = require('fs-extra');
class ImageCtrl extends upload_1.UploadCtrl {
    uploadBase64() {
        return __awaiter(this, void 0, void 0, function* () {
            const contentType = this.ctx.header['content-type'];
            const { dir, forceReplace, base64Field, thumb } = this.request.query;
            const { body } = this.request;
            const tmsFs = new LocalFS(this.domain, this.bucket);
            let upload = new UploadImage(tmsFs);
            let base64Content;
            if (contentType === 'text/plain') {
                base64Content = body;
            }
            else if (contentType === 'application/json') {
                if (!base64Field)
                    return new response_1.ResultFault('没有指定base64数据字段名');
                base64Content = body[base64Field];
            }
            else {
                return new response_1.ResultFault('不支持的内容类型');
            }
            try {
                const filepath = upload.storeBase64(base64Content, dir, forceReplace);
                const publicPath = upload.publicPath(filepath);
                if (contentType === 'application/json') {
                    const fsInfo = yield Info.ins(this.domain);
                    if (fsInfo) {
                        const info = this.request.body;
                        delete info[base64Field];
                        info.userid = this.client ? this.client.id : '';
                        info.bucket = this.bucket;
                        fsInfo.set(publicPath, info);
                    }
                }
                let stat = fs.statSync(filepath);
                let result = { path: publicPath, size: stat.size };
                if (thumb === 'Y') {
                    let thumbInfo = yield upload.makeThumb(filepath, false);
                    result.thumbPath = thumbInfo.path;
                    result.thumbSize = thumbInfo.size;
                }
                return new response_1.ResultData(result);
            }
            catch (e) {
                return new response_1.ResultFault(e.message);
            }
        });
    }
}
exports.ImageCtrl = ImageCtrl;
