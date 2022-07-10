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
exports.ManageCtrl = void 0;
const base_1 = require("./base");
const response_1 = require("../../response");
const { Info } = require('../../model/fs/info');
class ManageCtrl extends base_1.BaseCtrl {
    list() {
        return __awaiter(this, void 0, void 0, function* () {
            const fsInfo = yield Info.ins(this.domain);
            if (!fsInfo)
                return new response_1.ResultFault('不支持设置文件信息');
            const { bucket } = this;
            const query = {};
            if (bucket)
                query.bucket = bucket;
            const { batch } = this.request.query;
            const [page, size] = batch.split(',', 2);
            const skip = (parseInt(page) - 1) * parseInt(size);
            const limit = parseInt(size);
            const result = yield fsInfo.list(query, skip, limit);
            return new response_1.ResultData(result);
        });
    }
}
exports.ManageCtrl = ManageCtrl;
