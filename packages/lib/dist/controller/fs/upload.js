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
exports.UploadCtrl = void 0;
const base_1 = require("./base");
const { ResultData, ResultFault } = require('../../response');
const { UploadPlain } = require('../../model/fs/upload');
const { Info } = require('../../model/fs/info');
const { LocalFS } = require('../../model/fs/local');
class UploadCtrl extends base_1.BaseCtrl {
    plain() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.request.files || !this.request.files.file) {
                return new ResultFault('没有上传文件');
            }
            const { dir, forceReplace, thumb } = this.request.query;
            const tmsFs = new LocalFS(this.domain, this.bucket);
            const file = this.request.files.file;
            const upload = new UploadPlain(tmsFs);
            try {
                const filepath = yield upload.store(file, dir, forceReplace);
                let thumbInfo;
                if (thumb === 'Y') {
                    thumbInfo = yield upload.makeThumb(filepath, false);
                }
                const publicPath = upload.publicPath(filepath);
                const fsInfo = yield Info.ins(this.domain);
                if (fsInfo) {
                    const info = this.request.body;
                    info.userid = this.client ? this.client.id : '';
                    info.bucket = this.bucket;
                    fsInfo.set(publicPath, info);
                }
                let result = { path: publicPath, size: file.size };
                if (thumbInfo) {
                    result.thumbPath = thumbInfo.path;
                    result.thumbSize = thumbInfo.size;
                }
                return new ResultData(result);
            }
            catch (e) {
                return new ResultFault(e.message);
            }
        });
    }
}
exports.UploadCtrl = UploadCtrl;
