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
exports.BaseCtrl = void 0;
const ctrl_1 = require("../ctrl");
const response_1 = require("../../response");
const { Info } = require('../../model/fs/info');
const { FsContext } = require('../../app').Context;
const fs = require('fs');
const crypto = require('crypto');
const log4js = require('@log4js-node/log4js-api');
const logger = log4js.getLogger('tms-koa-fs-base');
class BaseCtrl extends ctrl_1.Ctrl {
    constructor(ctx, client, dbContext, mongoClient, pushContext) {
        super(ctx, client, dbContext, mongoClient, pushContext);
    }
    tmsBeforeEach() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!FsContext || !FsContext.insSync)
                return new response_1.ResultFault('文件服务不可用');
            this.fsContext = FsContext.insSync();
            let { domain, bucket } = this.request.query;
            if (domain) {
                if (!this.fsContext.isValidDomain(domain))
                    return new response_1.ResultFault(`指定的参数domain=${domain}不可用`);
                this.domain = this.fsContext.getDomain(domain);
            }
            else {
                this.domain = this.fsContext.getDomain(this.fsContext.defaultDomain);
            }
            const { path } = this.request.query;
            if (path) {
                const result = yield this.fsContext.checkClientACL(this.client, this.domain, this.bucket, path, this.request);
                if (result !== true)
                    return new response_1.ResultFault('没有访问指定目录或文件的权限');
            }
            return true;
        });
    }
    schemas() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.domain.schemas)
                return new response_1.ResultFault('没有设置文件扩展信息定义');
            return new response_1.ResultData(this.domain.schemas);
        });
    }
    setInfo() {
        return __awaiter(this, void 0, void 0, function* () {
            const { domain, bucket } = this;
            const fsInfo = yield Info.ins(domain);
            if (!fsInfo)
                return new response_1.ResultFault('不支持设置文件信息');
            const { path, setMD5 = 'N' } = this.request.query;
            if (!path)
                return new response_1.ResultFault('未指定文件路径');
            let space = domain.name;
            if (bucket)
                space += `/${bucket}`;
            if (!new RegExp(space).test(path)) {
                return new response_1.ResultFault('没有修改当前文件信息的权限');
            }
            const info = this.request.body;
            info.userid = this.client ? this.client.id : '';
            if (bucket)
                info.bucket = bucket;
            this._setFileInfo(fsInfo, path, info, setMD5);
            return new response_1.ResultData('ok');
        });
    }
    _setFileInfo(fsInfo, path, info, setMD5 = 'N') {
        return __awaiter(this, void 0, void 0, function* () {
            if (setMD5 === 'Y') {
                const PATH = require('path');
                let md5 = yield this.getFileMD5(PATH.join(this.fsContext.rootDir, path));
                if (md5 !== false)
                    info.md5 = md5;
            }
            return yield fsInfo.set(path, info);
        });
    }
    getFileMD5(path) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!fs.existsSync(path)) {
                logger.error('getFileMD5: ', path, ' 未找到指定文件');
                return Promise.resolve(false);
            }
            return new Promise((resolve) => {
                const hash = crypto.createHash('md5');
                const input = fs.createReadStream(path);
                let startTime = new Date().getTime();
                input.on('error', (err) => {
                    logger.error('getFileMD5', path, err);
                    return resolve(false);
                });
                input.on('data', (data) => {
                    hash.update(data);
                });
                input.on('end', () => {
                    let fileMD5 = hash.digest('hex');
                    logger.debug('文件:' +
                        path +
                        ',MD5签名为:' +
                        fileMD5 +
                        '.耗时:' +
                        (new Date().getTime() - startTime) / 1000.0 +
                        '秒');
                    return resolve(fileMD5);
                });
            });
        });
    }
    setInfos() {
        return __awaiter(this, void 0, void 0, function* () {
            const { domain, bucket } = this;
            const fsInfo = yield Info.ins(domain);
            if (!fsInfo)
                return new response_1.ResultFault('不支持设置文件信息');
            const { setMD5 = 'N' } = this.request.query;
            const files = this.request.body;
            if (!Array.isArray(files) || files.length === 0)
                return new response_1.ResultFault('未指定文件');
            let space = domain.name;
            if (bucket)
                space += `/${bucket}`;
            for (const file of files) {
                if (!new RegExp(space).test(file.path)) {
                    logger.debug('setInfos', file.path + ' 没有修改当前文件信息的权限');
                    continue;
                }
                let info = file.info || {};
                info.userid = this.client ? this.client.id : '';
                if (bucket)
                    info.bucket = bucket;
                this._setFileInfo(fsInfo, file.path, info, setMD5);
            }
            return new response_1.ResultData('ok');
        });
    }
}
exports.BaseCtrl = BaseCtrl;
