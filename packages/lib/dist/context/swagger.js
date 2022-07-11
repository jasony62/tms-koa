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
exports.Context = void 0;
const log4js = require('@log4js-node/log4js-api');
const logger = log4js.getLogger('tms-koa-swagger');
let _instance;
class Context {
    constructor(definition, apis) {
        this.definition = definition;
        this.apis = apis;
    }
    static init(swaggerConfig) {
        return __awaiter(this, void 0, void 0, function* () {
            if (_instance)
                return _instance;
            let { definition, apis } = swaggerConfig;
            if (!definition) {
                let msg = '配置文件中没有指定[definition]字段';
                logger.error(msg);
                throw new Error(msg);
            }
            if (!definition.info) {
                let msg = '配置文件中没有指定[definition.info]字段';
                logger.error(msg);
                throw new Error(msg);
            }
            let { info, servers } = definition;
            ['title', 'version'].forEach((field) => {
                if (!info[field]) {
                    let msg = `配置文件中没有指定[definition.info.${field}]字段`;
                    logger.error(msg);
                    throw new Error(msg);
                }
            });
            if (!Array.isArray(apis)) {
                logger.warn(`没有指定有效的API代码路径，设置为默认路径`);
                apis = ['./controllers/**/*.js'];
            }
            let swaggerDef = {};
            if (definition.openapi) {
                swaggerDef.openapi = definition.openapi;
            }
            else if (definition.swagger) {
                swaggerDef.swagger = definition.swagger;
            }
            else {
                swaggerDef.openapi = process.env.TMS_KOA_OAS_VERSION || '3.0.0';
            }
            swaggerDef.info = info;
            swaggerDef.servers = servers;
            _instance = new Context(swaggerDef, apis);
            logger.info(`完成Swagger服务设置。`);
            return _instance;
        });
    }
    static insSync() {
        return _instance;
    }
}
exports.Context = Context;
Context.ins = Context.init;
