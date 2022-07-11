"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalFS = void 0;
const fs = require('fs-extra');
const path = require('path');
const _ = require('lodash');
const LFS_APPROOTDIR = Symbol('lfs_appRootDir');
const LFS_ROOTDIR = Symbol('lfs_rootDir');
const LFS_DOMAIN = Symbol('lfs_domain');
const LFS_BUCKET = Symbol('lfs_bucket');
const LFS_THUMBDIR = Symbol('lfs_rootThumb');
const LFS_THUMB_WIDTH = Symbol('lfs_thumb_width');
const LFS_THUMB_HEIGHT = Symbol('lfs_thumb_height');
class LocalFS {
    constructor(domain, bucket = '') {
        if (!domain)
            Error('没有提供文件服务[domain]参数');
        const fsContext = this.getFsContext();
        let domainName;
        if (typeof domain === 'string') {
            domainName = domain;
        }
        else if (typeof domain === 'object') {
            domainName = domain.name;
            if (typeof domainName !== 'string' || domainName.length === 0)
                throw Error('没有提供文件服务[domain.name]参数');
        }
        else {
            if (!domain)
                Error('文件服务[domain]参数类型错误');
        }
        domain = fsContext.getDomain(domainName);
        if (!domain)
            throw Error(`指定的文件服务[domain=${domainName}]不存在`);
        const appRootDir = fsContext.rootDir;
        domainName = domainName.replace(/^\/|\/$/g, '');
        let rootDir = `${appRootDir}/${domainName}`;
        if (bucket) {
            bucket = bucket.replace(/^\/|\/$/g, '');
            rootDir += `/${bucket}`;
        }
        if (!fs.existsSync(rootDir))
            throw new Error(`指定的文件系统起始路径(${rootDir})不存在`);
        this[LFS_APPROOTDIR] = appRootDir;
        this[LFS_ROOTDIR] = rootDir;
        this[LFS_DOMAIN] = domain;
        this[LFS_BUCKET] = bucket;
        const { thumbnail } = fsContext;
        if (thumbnail && typeof thumbnail === 'object') {
            let thumbnailRootDir = `${appRootDir}/${domainName}/${thumbnail.dir || '_thumbs'}`;
            if (bucket)
                thumbnailRootDir += `/${bucket}`;
            this[LFS_THUMBDIR] = thumbnailRootDir;
            this[LFS_THUMB_WIDTH] = parseInt(thumbnail.width) || 100;
            this[LFS_THUMB_HEIGHT] = parseInt(thumbnail.height) || 100;
        }
    }
    getFsContext() {
        const { FsContext } = require('../../app').Context;
        if (!FsContext.insSync)
            throw new Error(`没有获得文件服务配置信息`);
        const fsContext = FsContext.insSync();
        return fsContext;
    }
    get appRootDir() {
        return this[LFS_APPROOTDIR];
    }
    get rootDir() {
        return this[LFS_ROOTDIR];
    }
    get thumbDir() {
        return this[LFS_THUMBDIR];
    }
    get thumbWidth() {
        return this[LFS_THUMB_WIDTH];
    }
    get thumbHeight() {
        return this[LFS_THUMB_HEIGHT];
    }
    get domain() {
        return this[LFS_DOMAIN];
    }
    fullpath(filename, isRelative = true) {
        let fullpath = isRelative ? path.join(this.rootDir, filename) : filename;
        return fullpath;
    }
    publicPath(fullpath) {
        let publicPath = fullpath.replace(path.normalize(this.appRootDir), '');
        const { AppContext } = require('../../app').Context;
        const prefix = _.get(AppContext.insSync(), 'router.fsdomain.prefix');
        if (prefix)
            publicPath = path.join(prefix, publicPath);
        return publicPath;
    }
    relativePath(fullpath) {
        let relativePath = fullpath.replace(path.normalize(this.rootDir), '');
        return relativePath;
    }
    thumbPath(filename, isRelative = true) {
        const thumbpath = path.join(this.thumbDir, isRelative ? filename : this.relativePath(filename));
        return thumbpath;
    }
    existsSync(filename, isRelative = true) {
        let fullpath = this.fullpath(filename, isRelative);
        return fs.existsSync(fullpath);
    }
    list(dir = '') {
        let fullpath = this.fullpath(dir);
        let names = fs.readdirSync(path.resolve(fullpath));
        let files = [];
        let dirs = [];
        names.forEach((name) => {
            let resolvedPath = path.resolve(fullpath, name);
            if (this.thumbDir) {
                if (new RegExp(`/${name}$`).test(this.thumbDir))
                    return;
            }
            let stats = fs.statSync(resolvedPath);
            if (stats.isFile()) {
                let publicPath = path.join(this.publicPath(fullpath), name);
                let fileinfo = {
                    name,
                    size: stats.size,
                    birthtime: stats.birthtimeMs,
                    path: publicPath,
                };
                files.push(fileinfo);
                if (/\.[png|jpg|jpeg]/i.test(name)) {
                    if (this.thumbDir) {
                        let thumbPath = this.publicPath(path.join(this.thumbPath(fullpath, false), name));
                        fileinfo.thumb = thumbPath;
                    }
                }
            }
            else if (stats.isDirectory()) {
                let dirents = fs.readdirSync(resolvedPath, { withFileTypes: true });
                let sub = { files: 0, dirs: 0 };
                dirents.forEach((dirent) => {
                    dirent.isFile() ? sub.files++ : dirent.isDirectory ? sub.dirs++ : 0;
                });
                dirs.push({ name, birthtime: stats.birthtimeMs, sub });
            }
        });
        return { files, dirs };
    }
    write(filename, content, isRelative = true, options = {}) {
        let fullpath = this.fullpath(filename, isRelative);
        let dirname = path.dirname(fullpath);
        fs.ensureDirSync(dirname, 0o2777);
        fs.writeFileSync(fullpath, content, options);
        return fullpath;
    }
    writeStream(filename, file, isRelative = true) {
        let fullpath = this.fullpath(filename, isRelative);
        let dirname = path.dirname(fullpath);
        fs.ensureDirSync(dirname, 0o2777);
        const reader = fs.createReadStream(file.path);
        const writer = fs.createWriteStream(fullpath);
        reader.pipe(writer);
        return new Promise((resolve) => {
            writer.on('close', function () {
                resolve(fullpath);
            });
        });
    }
    remove(filename, isRelative = true) {
        let fullpath = this.fullpath(filename, isRelative);
        fs.removeSync(fullpath);
    }
}
exports.LocalFS = LocalFS;
