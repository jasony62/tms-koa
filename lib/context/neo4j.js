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
exports.Context = exports.Neo4jConfig = void 0;
const log4js = require('@log4js-node/log4js-api');
const logger = log4js.getLogger('tms-koa-neo4j');
const neo4j = require('neo4j-driver');
class Neo4jConfig {
    constructor(config) {
        this.host = config['host'];
        this.port = config['port'];
        this.user = config['user'];
        this.password = config['password'];
    }
}
exports.Neo4jConfig = Neo4jConfig;
class Context {
    constructor(name, driver) {
        this._name = name;
        this._driver = driver;
    }
    session() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this._driver.session();
        });
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            logger.info(`开始关闭连接[${this._name}]`);
            let prom = yield this._driver.close();
            logger.info(`完成关闭连接[${this._name}]`);
            return prom;
        });
    }
    static ins(config, name) {
        return __awaiter(this, void 0, void 0, function* () {
            if (config === undefined) {
                return Context._instancesByName.get('master');
            }
            if (typeof config === 'string' && undefined === name) {
                return Context._instancesByName.get(config);
            }
            if (config instanceof Neo4jConfig) {
                let { host, port, user, password } = config;
                if (typeof host !== 'string') {
                    let msg = '没有指定neo4j的主机地址';
                    logger.error(msg);
                    throw Error(msg);
                }
                if (typeof port !== 'number') {
                    let msg = '没有指定neo4j连接的端口';
                    logger.error(msg);
                    throw Error(msg);
                }
                if (user && typeof user !== 'string') {
                    let msg = '没有指定neo4j的用户名';
                    logger.error(msg);
                    throw Error(msg);
                }
                if (password && typeof password !== 'string') {
                    let msg = '没有指定neo4j的密码';
                    logger.error(msg);
                    throw Error(msg);
                }
                let uri = `neo4j://${host}:${port}`;
                logger.debug('开始连接[%s]', uri);
                const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
                logger.debug('完成连接[%s]', uri);
                let ins = new Context(name, driver);
                Context._instancesByUri.set(uri, ins);
                Context._instancesByName.set(name, ins);
                return ins;
            }
            throw Error(`参数类型错误：${typeof config}`);
        });
    }
    static init(config) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!config || typeof config !== 'object') {
                let msg = '没有指定连接neo4j配置信息';
                logger.error(msg);
                throw Error(msg);
            }
            if (config['diabled'] === true) {
                return {};
            }
            const names = Object.keys(config).filter((n) => n !== 'disabled');
            if (names.length === 0) {
                let msg = '指定连接neo4j配置信息为空';
                logger.error(msg);
                throw Error(msg);
            }
            let instances;
            if (names.includes('host') && names.includes('port')) {
                instances = [yield Context.ins(new Neo4jConfig(config), 'master')];
            }
            else {
                instances = yield Promise.all(names.map((name) => Context.ins(new Neo4jConfig(config[name]), name)));
            }
            return instances;
        });
    }
    static close() {
        return __awaiter(this, void 0, void 0, function* () {
            let instances = [...Context._instancesByName.values()];
            return yield Promise.all(instances.map((ins) => ins.close()));
        });
    }
}
exports.Context = Context;
Context._instancesByUri = new Map();
Context._instancesByName = new Map();
//# sourceMappingURL=neo4j.js.map