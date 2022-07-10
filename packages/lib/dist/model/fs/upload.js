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
exports.UploadImage = exports.UploadPlain = exports.Upload = void 0;
const fs = require('fs-extra');
const path = require('path');
const moment = require('moment');
const log4js = require('@log4js-node/log4js-api');
const logger = log4js.getLogger('tms-koa-model-fs-upload');
class Upload {
    constructor(fs) {
        this.fs = fs;
    }
    get rootDir() {
        return this.fs.rootDir;
    }
    get domain() {
        return this.fs.domain;
    }
    get thumbWidth() {
        return this.fs.thumbWidth;
    }
    get thumbHeight() {
        return this.fs.thumbHeight;
    }
    autodir() {
        let dir;
        dir = moment().format('YYYYMM/DDHH');
        return dir;
    }
    autoname() {
        let name;
        name =
            moment().format('mmss') +
                +(Math.floor(Math.random() * (9999 - 1000)) + 1000);
        return name;
    }
    storename(ext) {
        let name;
        name = this.autodir() + '/' + this.autoname();
        name += /^\./.test(ext) ? ext : `.${ext}`;
        return name;
    }
    publicPath(fullpath) {
        return this.fs.publicPath(fullpath);
    }
    makeThumb(filepath, isRelative = true) {
        return __awaiter(this, void 0, void 0, function* () {
            const sharp = require('sharp');
            if (!this.fs.thumbDir)
                return false;
            const ext = path.extname(filepath);
            if (/\.[png|jpg|jpeg]/i.test(ext)) {
                const fullpath = isRelative ? this.fs.fullpath(filepath) : filepath;
                const thumbPath = this.fs.thumbPath(filepath, isRelative);
                const thumbnail = yield sharp(fullpath)
                    .resize(this.thumbWidth, this.thumbHeight, { fit: 'inside' })
                    .toBuffer();
                this.fs.write(thumbPath, thumbnail, false);
                let stat = fs.statSync(thumbPath);
                return {
                    path: this.publicPath(thumbPath),
                    size: stat.size,
                    width: this.thumbWidth,
                    height: this.thumbHeight,
                };
            }
            return false;
        });
    }
}
exports.Upload = Upload;
class UploadPlain extends Upload {
    constructor(fs) {
        super(fs);
    }
    store(file, dir, forceReplace = 'N') {
        return __awaiter(this, void 0, void 0, function* () {
            let filename;
            if (this.domain.customName === true) {
                dir = typeof dir === 'string' ? dir.replace(/(^\/|\/$)/g, '') : '';
                if (dir.length) {
                    filename = `${dir}/${file.name}`;
                }
                else {
                    filename = this.autodir() + '/' + file.name;
                }
            }
            else {
                let ext = path.extname(file.name);
                filename = this.storename(ext);
            }
            if (forceReplace !== 'Y') {
                if (this.fs.existsSync(filename)) {
                    throw new Error('文件已经存在');
                }
            }
            let filepath = yield this.fs.writeStream(filename, file);
            return filepath;
        });
    }
    storeByUrl(fileUrl, dir, forceReplace = 'N', fileName = '', axiosInstance = null) {
        return __awaiter(this, void 0, void 0, function* () {
            const axios = require('axios');
            if (!({}.toString.call(axiosInstance) === '[object Function]' &&
                typeof axiosInstance.request === 'function')) {
                axiosInstance = axios.create({
                    url: fileUrl,
                    method: 'get',
                });
            }
            axiosInstance.defaults.responseType = 'arraybuffer';
            return axiosInstance
                .request()
                .catch((err) => {
                logger.error(err);
                throw new Error('未知错误: ' + fileUrl);
            })
                .then((file) => __awaiter(this, void 0, void 0, function* () {
                if (file.status != '200') {
                    throw new Error('下载失败: 状态码错误' + fileUrl);
                }
                if (file.headers['content-type'].indexOf('application/json') !== -1) {
                    throw new Error('下载失败, 返回类型错误: ' + fileUrl);
                }
                if (!fileName) {
                    if (file.headers['content-disposition']) {
                        let dispositions = file.headers['content-disposition'].replace(/\s/g, '');
                        dispositions = dispositions.split(';');
                        dispositions.forEach((dis) => {
                            let disArr = dis.split('=');
                            if (disArr[0] === 'filename')
                                fileName = disArr[1].replace(/('|")/g, '');
                        });
                    }
                }
                if (this.domain.customName === true) {
                    if (!fileName)
                        fileName = this.autoname();
                    dir = typeof dir === 'string' ? dir.replace(/(^\/|\/$)/g, '') : '';
                    if (dir.length) {
                        fileName = `${dir}/${fileName}`;
                    }
                    else {
                        fileName = this.autodir() + '/' + fileName;
                    }
                }
                else {
                    let ext = path.extname(fileName);
                    fileName = this.storename(ext);
                }
                if (forceReplace !== 'Y') {
                    if (this.fs.existsSync(fileName)) {
                        throw new Error('文件已经存在');
                    }
                }
                let filepath = yield this.fs.write(fileName, file.data, true, {
                    encoding: 'binary',
                });
                return filepath;
            }));
        });
    }
}
exports.UploadPlain = UploadPlain;
class UploadImage extends Upload {
    constructor(fs) {
        super(fs);
    }
    storeBase64(base64Content, dir, forceReplace = 'N') {
        if (!base64Content)
            return false;
        let matches = base64Content.match(/data:image\/(\w+);base64,/);
        if (!matches || matches.length !== 2)
            throw new Error('保存的数据不是base64格式的图片');
        let [header, imageType] = matches;
        if (imageType === 'jpeg')
            imageType = 'jpg';
        let imageBase64 = base64Content.replace(header, '');
        let imageBuffer = Buffer.from(imageBase64, 'base64');
        let filename;
        if (this.domain.customName === true) {
            dir = typeof dir === 'string' ? dir.replace(/(^\/|\/$)/g, '') : '';
            if (dir.length) {
                filename = `${dir}/${this.autoname()}.${imageType}`;
            }
            else {
                filename = this.storename(imageType);
            }
        }
        else {
            filename = this.storename(imageType);
        }
        if (forceReplace !== 'Y') {
            if (this.fs.existsSync(filename)) {
                throw new Error('文件已经存在');
            }
        }
        let fullname = this.fs.write(filename, imageBuffer);
        return fullname;
    }
    storeByUrl() { }
}
exports.UploadImage = UploadImage;
