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
const log4js = require('@log4js-node/log4js-api');
const logger = log4js.getLogger('tms-koa-ctrl');
const Router = require('@koa/router');
const _ = require('lodash');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const nodePath = require('path');
const { AppContext, DbContext, MongoContext, PushContext } = require('../app').Context;
const TrustedHostsFile = nodePath.resolve(process.cwd(), process.env.TMS_KOA_CONFIG_DIR || 'config', 'trusted-hosts.js');
let trustedHosts = {};
if (fs.existsSync(TrustedHostsFile)) {
    logger.info(`从${TrustedHostsFile}加载信任主机列表`);
    Object.assign(trustedHosts, require(TrustedHostsFile));
}
else {
    logger.info(`未从${TrustedHostsFile}获得信任主机列表`);
}
const { ResultFault, AccessTokenFault } = require('../response');
const CtrlDir = process.env.TMS_KOA_CONTROLLERS_DIR || process.cwd() + '/controllers';
function findCtrlClassInControllers(ctrlName, path) {
    let ctrlPath = nodePath.resolve(`${CtrlDir}/${ctrlName}.js`);
    if (!fs.existsSync(ctrlPath)) {
        ctrlPath = nodePath.resolve(`${CtrlDir}/${ctrlName}/main.js`);
        if (!fs.existsSync(ctrlPath)) {
            let logMsg = `参数错误，请求的控制器不存在(2)`;
            logger.isDebugEnabled()
                ? logger.debug(logMsg, ctrlName, path, ctrlPath)
                : logger.error(logMsg);
            throw new Error(logMsg);
        }
    }
    let CtrlClass = require(ctrlPath);
    if (CtrlClass.default)
        CtrlClass = CtrlClass.default;
    return CtrlClass;
}
function findCtrlClassAndMethodName(ctx) {
    let { path } = ctx.request;
    if (prefix)
        path = path.replace(prefix, '');
    let pieces = path.split('/').filter((p) => p);
    if (pieces.length === 0) {
        let logMsg = '参数错误，请求的控制器不存在(1)';
        logger.isDebugEnabled()
            ? logger.debug(logMsg, path, pieces)
            : logger.error(logMsg);
        throw new Error(logMsg);
    }
    let CtrlClass;
    const method = pieces.splice(-1, 1)[0];
    const ctrlName = pieces.length ? pieces.join('/') : 'main';
    const npmCtrls = _.get(AppContext.insSync(), 'router.controllers.plugins_npm');
    let npmCtrl;
    if (Array.isArray(npmCtrls) && npmCtrls.length) {
        npmCtrl = npmCtrls.find((nc) => new RegExp(`${nc.alias}|${nc.id}`).test(ctrlName.split('/')[0]));
    }
    if (npmCtrl) {
        logger.debug(`控制器插件${JSON.stringify(npmCtrl)}匹配当前请求`);
        try {
            if (ctrlName.split('/')[0] === npmCtrl.alias) {
                CtrlClass = require(ctrlName.replace(npmCtrl.alias, npmCtrl.id));
            }
            else {
                CtrlClass = require(ctrlName);
            }
        }
        catch (e) {
            logger.warn(`查找npm控制器[${ctrlName}]失败[${e.message}]`, e);
            CtrlClass = findCtrlClassInControllers(ctrlName, path);
        }
    }
    else {
        CtrlClass = findCtrlClassInControllers(ctrlName, path);
    }
    return [ctrlName, CtrlClass, method];
}
function getAccessTokenByRequest(ctx) {
    let access_token;
    let { request } = ctx;
    let { authorization } = ctx.header;
    if (authorization && authorization.indexOf('Bearer') === 0) {
        access_token = authorization.match(/\S+$/)[0];
    }
    else if (request.query.access_token) {
        access_token = request.query.access_token;
    }
    else {
        return [false, '缺少Authorization头或access_token参数'];
    }
    return [true, access_token];
}
function fnCtrlWrapper(ctx, next) {
    return __awaiter(this, void 0, void 0, function* () {
        let { request, response } = ctx;
        if (/\./.test(request.path)) {
            response.status = 404;
            return (response.body = 'Not Found');
        }
        let findCtrlResult;
        try {
            findCtrlResult = findCtrlClassAndMethodName(ctx);
        }
        catch (e) {
            let logMsg = e.message || `无法识别指定的请求，请检查输入的路径是否正确`;
            logger.isDebugEnabled() ? logger.debug(logMsg, e) : logger.error(logMsg);
            return (response.body = new ResultFault(logMsg));
        }
        const [ctrlName, CtrlClass, method] = findCtrlResult;
        let tmsClient;
        const authConfig = AppContext.insSync().auth;
        let accessWhite;
        if (Object.prototype.hasOwnProperty.call(CtrlClass, 'tmsAccessWhite')) {
            accessWhite = CtrlClass.tmsAccessWhite();
            if (!Array.isArray(accessWhite)) {
                logger.warn(`控制器"${ctrlName}"白名单格式错误`, accessWhite);
                return (response.body = new ResultFault('控制器认证白名单方法返回值格式错误'));
            }
        }
        if (accessWhite && accessWhite.includes(method)) {
        }
        else if (Object.prototype.hasOwnProperty.call(CtrlClass, 'tmsAuthTrustedHosts')) {
            if (!trustedHosts[ctrlName] ||
                !Array.isArray(trustedHosts[ctrlName]) ||
                trustedHosts[ctrlName].length === 0) {
                let msg = `没有指定【${ctrlName}】可信任的请求来源主机`;
                logger.debug(msg + '\n' + JSON.stringify(trustedHosts, null, 2));
                return (response.body = new ResultFault(msg));
            }
            if (!request.ip)
                return (response.body = new ResultFault('无法获得请求来源主机的ip地址'));
            const ipv4 = request.ip.split(':').pop();
            const ctrlTrustedHosts = trustedHosts[ctrlName];
            if (!ctrlTrustedHosts.some((rule) => {
                const re = new RegExp(rule);
                return re.test(request.ip) || re.test(ipv4);
            })) {
                logger.warn(`未被信任的主机进行请求[${request.ip}]`);
                return (response.body = new ResultFault('请求来源主机不在信任列表中'));
            }
        }
        else if (authConfig && authConfig.mode) {
            let [success, access_token] = getAccessTokenByRequest(ctx);
            if (false === success)
                return (response.body = new ResultFault(access_token));
            if (authConfig.jwt) {
                try {
                    let decoded = jwt.verify(access_token, authConfig.jwt.privateKey);
                    tmsClient = require('../auth/client').createByData(decoded);
                }
                catch (e) {
                    if (e.name === 'TokenExpiredError') {
                        response.body = new AccessTokenFault('认证令牌过期');
                    }
                    else {
                        response.body = new ResultFault(e.message);
                    }
                    return;
                }
            }
            else if (authConfig.redis) {
                const Token = require('../auth/token');
                let aResult = yield Token.fetch(access_token);
                if (false === aResult[0]) {
                    response.body = new AccessTokenFault(aResult[1]);
                    return;
                }
                tmsClient = aResult[1];
                yield Token.expire(access_token, tmsClient);
            }
        }
        let dbContext, mongoClient, pushContext;
        try {
            if (DbContext) {
                dbContext = new DbContext();
            }
            if (MongoContext) {
                mongoClient = yield MongoContext.mongoClient();
            }
            if (PushContext)
                pushContext = yield PushContext.ins();
            const oCtrl = new CtrlClass(ctx, tmsClient, dbContext, mongoClient, pushContext);
            if (oCtrl[method] === undefined && typeof oCtrl[method] !== 'function') {
                let logMsg = '参数错误，请求的控制器不存在(3)';
                logger.isDebugEnabled()
                    ? logger.debug(logMsg, oCtrl)
                    : logger.error(logMsg);
                return (response.body = new ResultFault(logMsg));
            }
            const appContext = AppContext.insSync();
            let bucketValidateResult;
            if (Object.prototype.hasOwnProperty.call(CtrlClass, 'tmsBucketValidator')) {
                bucketValidateResult = yield CtrlClass.tmsBucketValidator(tmsClient);
            }
            else if (appContext.checkClientBucket) {
                bucketValidateResult = yield appContext.checkClientBucket(ctx, tmsClient);
            }
            if (bucketValidateResult) {
                const [passed, bucket] = bucketValidateResult;
                if (passed !== true)
                    return (response.body = new ResultFault('没有访问指定bucket资源的权限'));
                if (typeof bucket === 'string')
                    oCtrl.bucket = bucket;
            }
            if (oCtrl.tmsBeforeEach && typeof oCtrl.tmsBeforeEach === 'function') {
                const resultBefore = yield oCtrl.tmsBeforeEach(method);
                if (resultBefore instanceof ResultFault) {
                    return (response.body = resultBefore);
                }
            }
            const result = yield oCtrl[method](request);
            response.body = result;
            next();
        }
        catch (err) {
            logger.error('控制器执行异常', err);
            let errMsg = typeof err === 'string' ? err : err.message ? err.message : err.toString();
            response.body = new ResultFault(errMsg);
        }
        finally {
            if (dbContext) {
                dbContext.end();
                dbContext = null;
            }
        }
    });
}
const prefix = AppContext.insSync().routerControllersPrefix;
logger.info(`API控制器目录：${CtrlDir}，指定API控制器前缀：${prefix}`);
const router = new Router({ prefix });
router.all('/(.*)', fnCtrlWrapper);
module.exports = router;
