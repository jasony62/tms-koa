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
exports.loadConfig = exports.Context = exports.TmsKoa = void 0;
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const _ = require('lodash');
const Koa = require('koa');
const koaBody = require('koa-body');
const koaStatic = require('koa-static');
const cors = require('@koa/cors');
const log4js = require('@log4js-node/log4js-api');
const logger = log4js.getLogger('tms-koa');
require('dotenv-flow').config();
let AppContext, DbContext, MongoContext, RedisContext, FsContext, PushContext, SwaggerContext, MetricsContext, Neo4jContext;
const Context = {};
exports.Context = Context;
process.on('uncaughtException', (err) => {
    logger.warn('uncaughtException error:', err);
});
process.on('unhandledRejection', (reason) => {
    logger.warn('Unhandled Rejection reason:', reason);
});
process.on('exit', (code) => {
    logger.info(`退出应用[code=${code}]`);
});
process.on('SIGINT', () => __awaiter(void 0, void 0, void 0, function* () {
    logger.info(`退出应用[ctrl+c]`);
    if (Neo4jContext)
        yield Neo4jContext.close();
    process.exit();
}));
process.on('SIGTERM', () => __awaiter(void 0, void 0, void 0, function* () {
    logger.info(`退出应用[kill]`);
    if (Neo4jContext)
        yield Neo4jContext.close();
    process.exit();
}));
const ConfigDir = process.env.TMS_KOA_CONFIG_DIR || process.cwd() + '/config';
function loadConfig(name, defaultConfig) {
    let basepath = path.resolve(ConfigDir, `${name}.js`);
    let baseConfig;
    if (fs.existsSync(basepath)) {
        baseConfig = require(basepath);
        logger.info(`从[${basepath}]加载配置`);
    }
    else {
        logger.warn(`[${name}]配置文件[${basepath}]不存在`);
    }
    let localpath = path.resolve(ConfigDir, `${name}.local.js`);
    let localConfig;
    if (fs.existsSync(localpath)) {
        localConfig = require(localpath);
        logger.info(`从[${localpath}]加载本地配置`);
    }
    if (defaultConfig || baseConfig || localConfig) {
        return _.merge({}, defaultConfig, baseConfig, localConfig);
    }
    return false;
}
exports.loadConfig = loadConfig;
class TmsKoa extends Koa {
    constructor(options) {
        super(options);
    }
    startup({ beforeController, afterController, afterInit, }) {
        return __awaiter(this, void 0, void 0, function* () {
            logger.info(`配置文件获取目录：${ConfigDir}`);
            const appConfig = loadConfig('app', { port: 3000 });
            AppContext = require('./context/app').Context;
            try {
                yield AppContext.init(appConfig);
                Context.AppContext = AppContext;
            }
            catch (e) {
                let logMsg = `初始化[app]配置失败`;
                logger.isDebugEnabled() ? logger.debug(logMsg, e) : logger.warn(logMsg);
                process.exit(0);
            }
            const dbConfig = loadConfig('db');
            if (dbConfig && dbConfig.disabled !== true) {
                DbContext = require('tms-db').DbContext;
                try {
                    yield DbContext.init(dbConfig);
                    Context.DbContext = DbContext;
                }
                catch (e) {
                    let logMsg = `初始化[db]配置失败`;
                    logger.isDebugEnabled() ? logger.debug(logMsg, e) : logger.warn(logMsg);
                }
            }
            const mongoConfig = loadConfig('mongodb');
            if (mongoConfig && mongoConfig.disabled !== true) {
                MongoContext = require('./context/mongodb').Context;
                try {
                    yield MongoContext.init(mongoConfig);
                    Context.MongoContext = MongoContext;
                }
                catch (e) {
                    let logMsg = `初始化[mongodb]配置失败`;
                    logger.isDebugEnabled() ? logger.debug(logMsg, e) : logger.warn(logMsg);
                }
            }
            const redisConfig = loadConfig('redis');
            if (redisConfig && redisConfig.disabled !== true) {
                RedisContext = require('./context/redis').Context;
                try {
                    yield RedisContext.init(redisConfig);
                    Context.RedisContext = RedisContext;
                }
                catch (e) {
                    let logMsg = `初始化[redis]配置失败`;
                    logger.isDebugEnabled() ? logger.debug(logMsg, e) : logger.warn(logMsg);
                }
            }
            const neo4jConfig = loadConfig('neo4j');
            if (neo4jConfig && neo4jConfig.disabled !== true) {
                Neo4jContext = require('./context/neo4j').Context;
                try {
                    yield Neo4jContext.init(neo4jConfig);
                    Context.Neo4jContext = Neo4jContext;
                }
                catch (e) {
                    let logMsg = `初始化[neo4j]配置失败`;
                    logger.isDebugEnabled() ? logger.debug(logMsg, e) : logger.warn(logMsg);
                }
            }
            const fsConfig = loadConfig('fs');
            if (fsConfig && fsConfig.disabled !== true) {
                FsContext = require('./context/fs').Context;
                try {
                    yield FsContext.init(fsConfig);
                    Context.FsContext = FsContext;
                }
                catch (e) {
                    let logMsg = `初始化[fs]配置失败`;
                    logger.isDebugEnabled() ? logger.debug(logMsg, e) : logger.warn(logMsg);
                }
            }
            const pushConfig = loadConfig('push');
            if (pushConfig && pushConfig.disabled !== true) {
                PushContext = require('./context/push').Context;
                try {
                    yield PushContext.init(pushConfig);
                    Context.PushContext = PushContext;
                }
                catch (e) {
                    let logMsg = `初始化[push]配置失败`;
                    logger.isDebugEnabled() ? logger.debug(logMsg, e) : logger.warn(logMsg);
                }
            }
            const swaggerConfig = loadConfig('swagger');
            if (swaggerConfig && swaggerConfig.disabled !== true) {
                SwaggerContext = require('./context/swagger').Context;
                try {
                    yield SwaggerContext.init(swaggerConfig);
                    Context.SwaggerContext = SwaggerContext;
                }
                catch (e) {
                    let logMsg = `初始化[swagger]配置失败`;
                    logger.isDebugEnabled() ? logger.debug(logMsg, e) : logger.warn(logMsg);
                }
            }
            const metricsConfig = loadConfig('metrics');
            if (metricsConfig && metricsConfig.disabled !== true) {
                MetricsContext = require('./context/metrics').Context;
                try {
                    yield MetricsContext.init(metricsConfig);
                    Context.MetricsContext = MetricsContext;
                }
                catch (e) {
                    let logMsg = `初始化[metrics]配置失败`;
                    logger.isDebugEnabled() ? logger.debug(logMsg, e) : logger.warn(logMsg);
                }
            }
            const corsOptions = _.get(AppContext.insSync(), 'cors');
            this.use(cors(corsOptions));
            if (Context.SwaggerContext) {
                let swaggerRouter = require('./swagger/router');
                this.use(swaggerRouter.routes());
            }
            if (Context.MetricsContext) {
                let metricsRouter = require('./metrics/router');
                this.use(metricsRouter.routes());
            }
            let staticPath = process.cwd() + '/public';
            if (fs.existsSync(staticPath)) {
                this.use(koaStatic(staticPath));
            }
            if (Context.FsContext) {
                let diskRouter = require('./fsdomain/router');
                this.use(diskRouter.routes());
            }
            this.use(koaBody({
                jsonLimit: (appConfig.body && appConfig.body.jsonLimit) || '1mb',
                formLimit: (appConfig.body && appConfig.body.formLimit) || '56kb',
                textLimit: (appConfig.body && appConfig.body.textLimit) || '56kb',
                multipart: true,
                formidable: {
                    maxFileSize: 200 * 1024 * 1024,
                },
            }));
            const authConfig = _.get(AppContext.insSync(), 'auth');
            if (typeof authConfig === 'object' && Object.keys(authConfig).length) {
                let router = require('./auth/router');
                this.use(router.routes());
                if (authConfig.mode)
                    logger.info(`启用API调用认证机制[${authConfig.mode}]`);
                if (authConfig.captcha)
                    logger.info(`启用验证码服务`);
            }
            if (Array.isArray(beforeController)) {
                beforeController.forEach((m) => this.use(m));
            }
            let router = require('./controller/router');
            this.use(router.routes());
            if (Array.isArray(afterController)) {
                afterController.forEach((m) => this.use(m));
            }
            if (afterInit && typeof afterInit === 'function') {
                yield afterInit(Context);
            }
            let serverCallback = this.callback();
            const appContext = AppContext.insSync();
            try {
                const httpServer = http.createServer(serverCallback);
                httpServer.listen(appContext.port, (err) => {
                    if (err) {
                        logger.error(`启动http端口【${appContext.port}】失败: `, err);
                    }
                    else {
                        logger.info(`完成启动http端口：${appContext.port}`);
                    }
                });
            }
            catch (ex) {
                logger.error('启动http服务失败\n', ex, ex && ex.stack);
            }
            if (typeof appContext.https === 'object' &&
                appContext.https.disabled !== true) {
                const { port, key, cert } = appContext.https;
                try {
                    const httpsServer = https.createServer({
                        key: fs.readFileSync(key, 'utf8').toString(),
                        cert: fs.readFileSync(cert, 'utf8').toString(),
                    }, serverCallback);
                    httpsServer.listen(port, (err) => {
                        if (err) {
                            logger.error(`启动https端口【${port}】失败: `, err);
                        }
                        else {
                            logger.info(`完成启动https端口：${port}`);
                        }
                    });
                }
                catch (ex) {
                    logger.error('启动https服务失败\n', ex, ex && ex.stack);
                }
            }
        });
    }
}
exports.TmsKoa = TmsKoa;
