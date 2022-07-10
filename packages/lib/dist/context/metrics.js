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
const logger = log4js.getLogger('tms-koa-metrics');
const PromClient = require('prom-client');
const { Registry } = PromClient;
const { ProfileCollector } = require('../metrics/collector/mongodb/profile');
function startSystemProfile(config) {
    return __awaiter(this, void 0, void 0, function* () {
        let { db, prefix } = config;
        if (!db || typeof db !== 'string') {
            logger.warn(`监控服务配置文件中,未指定参数db，或数据类型不是字符串`);
            return false;
        }
        const { MongoContext } = require('../app').Context;
        if (MongoContext) {
            const mongoClient = yield MongoContext.mongoClient();
            const pc = new ProfileCollector(mongoClient, db, prefix);
            pc.run();
        }
    });
}
let _instance;
class Context {
    constructor(register) {
        this.register = register;
    }
    static init(metricsConfig) {
        return __awaiter(this, void 0, void 0, function* () {
            if (_instance)
                return _instance;
            const register = new Registry();
            let { collectDefault, systemProfile } = metricsConfig;
            if (collectDefault === true) {
                let msg = '提供默认系统监控指标';
                logger.info(msg);
                const collectDefaultMetrics = PromClient.collectDefaultMetrics;
                collectDefaultMetrics({ register });
            }
            _instance = new Context(register);
            if (systemProfile) {
                if (Array.isArray(systemProfile)) {
                    systemProfile.forEach((config) => startSystemProfile(config));
                }
                else if (typeof systemProfile === 'object') {
                    startSystemProfile(systemProfile);
                }
            }
            logger.info(`完成监控服务设置。`);
            return _instance;
        });
    }
    static insSync() {
        return _instance;
    }
}
Context.ins = Context.init;
