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
const path = require('path');
const _ = require('lodash');
const log4js = require('@log4js-node/log4js-api');
const logger = log4js.getLogger('tms-koa-fsdomain');
const Router = require('@koa/router');
const send = require('koa-send');
const { AppContext, FsContext } = require('../app').Context;
const prefix = _.get(AppContext.insSync(), ['router', 'fsdomain', 'prefix'], 'fsdomain');
let msg = `启用文件服务的下载服务，地址前缀：${prefix}。`;
logger.info(msg);
const router = new Router({ prefix });
function findDiskFile(ctx, next) {
    return __awaiter(this, void 0, void 0, function* () {
        let accessDomain = false;
        if (ctx.method === 'HEAD' || ctx.method === 'GET') {
            const filepath = decodeURIComponent(ctx.path.replace(prefix, ''));
            const fsConfig = FsContext.insSync();
            if (fsConfig.domains && typeof fsConfig.domains === 'object') {
                if (Object.keys(fsConfig.domains).some((domain) => filepath.indexOf(`/${domain}`) === 0))
                    accessDomain = true;
            }
            if (accessDomain) {
                try {
                    const root = path.resolve(fsConfig.rootDir);
                    if (ctx.request.query.download === 'Y')
                        ctx.attachment(filepath);
                    yield send(ctx, filepath, { root });
                }
                catch (err) {
                    if (err.status !== 404) {
                        throw err;
                    }
                }
            }
        }
        if (!accessDomain) {
            yield next();
        }
    });
}
router.all('/(.*)', findDiskFile);
module.exports = router;
