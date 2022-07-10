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
exports.BrowseCtrl = void 0;
const base_1 = require("./base");
const response_1 = require("../../response");
const { LocalFS } = require('../../model/fs/local');
const { Info } = require('../../model/fs/info');
class BrowseCtrl extends base_1.BaseCtrl {
    getBizInfo(path) {
        return __awaiter(this, void 0, void 0, function* () {
            const fsInfo = yield Info.ins(this.domain);
            if (!fsInfo)
                return new response_1.ResultFault('不支持设置文件信息');
            const info = yield fsInfo.get(path);
            if (info)
                delete info.path;
            return info;
        });
    }
    list() {
        return __awaiter(this, void 0, void 0, function* () {
            let { dir } = this.request.query;
            let localFS = new LocalFS(this.domain, this.bucket);
            let { files, dirs } = localFS.list(dir);
            for (let i = 0, ii = files.length; i < ii; i++) {
                let file = files[i];
                let info = yield this.getBizInfo(file.path);
                file.info = info instanceof response_1.ResultFault ? {} : info;
            }
            return new response_1.ResultData({ files, dirs });
        });
    }
}
exports.BrowseCtrl = BrowseCtrl;
