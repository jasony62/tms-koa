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
const logger = log4js.getLogger('tms-koa-fs');
const fs = require('fs');
function initRootDir(instance, lfsConfig) {
    const rootDir = lfsConfig.rootDir.replace(/\/$/, '');
    instance.rootDir = rootDir;
    if (typeof lfsConfig.outDir === 'string' &&
        !fs.existsSync(lfsConfig.outDir)) {
        fs.mkdirSync(lfsConfig.outDir, { recursive: true });
        logger.info(`创建系统生成文件存储目录(${lfsConfig.outDir})`);
    }
}
function initThumb(instance, lfsConfig) {
    const { thumbnail } = lfsConfig;
    if (thumbnail &&
        typeof thumbnail === 'object' &&
        thumbnail.disabled !== true) {
        instance.thumbnail = {};
        const { dir, width, height } = thumbnail;
        if (dir && typeof dir === 'string') {
            if (/\//.test(dir))
                logger.warn(`缩略图目录参数不允许包含反斜杠，系统已自动去除`);
            instance.thumbnail.dir = dir.replace(/\//, '');
        }
        if (parseInt(width))
            instance.thumbnail.width = parseInt(width);
        if (parseInt(height))
            instance.thumbnail.height = parseInt(height);
        logger.info(`创建缩略图服务(${JSON.stringify(instance.thumbnail)})`);
    }
}
function initDomains(instance, lfsConfig) {
    return __awaiter(this, void 0, void 0, function* () {
        const domains = {};
        if (lfsConfig.domains && typeof lfsConfig.domains === 'object') {
            const { domains: lfsDomains } = lfsConfig;
            let configDomainNames = Object.keys(lfsDomains);
            for (let i = 0; i < configDomainNames.length; i++) {
                let name = configDomainNames[i];
                let domain = yield initDomain(instance, name, lfsDomains[name]);
                if (domain)
                    domains[name] = domain;
            }
        }
        let domainNames = Object.keys(domains);
        if (domainNames.length === 0) {
            domains.upload = yield initDomain(instance, 'upload');
            domainNames = ['upload'];
        }
        let { defaultDomain } = lfsConfig;
        if (defaultDomain) {
            if (!domains[defaultDomain]) {
                logger.warn(`文件服务配置文件中的默认域（${defaultDomain}）不存在`);
                return false;
            }
        }
        else {
            defaultDomain = domainNames[0];
        }
        instance.domains = domains;
        instance.defaultDomain = defaultDomain;
        return instance;
    });
}
function initDomain(instance, name, lfsDomain) {
    return __awaiter(this, void 0, void 0, function* () {
        if (lfsDomain && lfsDomain.disabled === true)
            return false;
        const { rootDir } = instance;
        const domainDir = `${rootDir}/${name}`;
        if (!fs.existsSync(domainDir)) {
            fs.mkdirSync(domainDir, { recursive: true });
            logger.info(`创建文件服务域目录(${domainDir})`);
        }
        const domain = { name };
        if (lfsDomain) {
            domain.customName = !!lfsDomain.customName;
            if (lfsDomain && typeof lfsDomain === 'object') {
                yield initMongoDb(domain, lfsDomain);
            }
            initACL(domain, lfsDomain);
        }
        return domain;
    });
}
function initMongoDb(domain, lfsConfig) {
    return __awaiter(this, void 0, void 0, function* () {
        if (typeof lfsConfig.database !== 'object' ||
            lfsConfig.database.disabled === true) {
            logger.warn(`文件服务配置文件中没有给域（${domain.name}）指定数据库`);
            return false;
        }
        if (typeof lfsConfig.schemas !== 'object') {
            logger.warn(`文件服务配置文件中没有给域（${domain.name}）指定的扩展信息定义`);
            return false;
        }
        let fsDbConfig = lfsConfig.database;
        if (fsDbConfig) {
            if (typeof fsDbConfig.dialect !== 'string' || !fsDbConfig.dialect) {
                logger.warn(`文件服务配置文件中域（${domain.name}）[dialect]参数不可用`);
                return false;
            }
            if (typeof fsDbConfig.source !== 'string' || !fsDbConfig.source) {
                logger.error(`文件服务配置文件中域（${domain.name}）[source]参数不可用`);
                return false;
            }
            let fsSchemas = lfsConfig.schemas;
            const { source } = fsDbConfig;
            const MongoContext = require('./mongodb').Context;
            const mongoClient = yield MongoContext.mongoClient(source);
            if (!mongoClient) {
                logger.error(`文件服务配置文件中域（${domain.name}）指定的mongodb[${source}]不可用`);
                return false;
            }
            if (typeof fsDbConfig.database !== 'string' || !fsDbConfig.database) {
                logger.error(`文件服务配置文件中域（${domain.name}）指定[database]不可用`);
                return false;
            }
            if (typeof fsDbConfig.file_collection !== 'string' ||
                !fsDbConfig.file_collection) {
                logger.error(`文件服务配置文件中域（${domain.name}）指定[file_collection]不可用`);
                return false;
            }
            domain.mongoClient = mongoClient;
            domain.database = fsDbConfig.database;
            domain.collection = fsDbConfig.file_collection;
            domain.schemas = fsSchemas;
            return domain;
        }
    });
}
function initACL(domain, lfsDomain) {
    const { accessControl } = lfsDomain;
    if (accessControl && accessControl.path) {
        if (fs.existsSync(accessControl.path)) {
            const validator = require(accessControl.path);
            if (typeof validator === 'function') {
                domain.aclValidator = validator;
            }
        }
    }
    return domain;
}
let _instance;
class Context {
    isValidDomain(name) {
        return Object.prototype.hasOwnProperty.call(this.domains, name);
    }
    getDomain(name) {
        return this.domains[name];
    }
    checkClientACL(client, domain, bucket, path, request) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!domain)
                throw Error(`指定的域（${domain.name}）不存在`);
            if (!domain.aclValidator)
                return true;
            if (!client || !path)
                return true;
            const result = yield domain.aclValidator(client, domain.name, bucket, path, request);
            return result;
        });
    }
    static init(fsConfig) {
        return __awaiter(this, void 0, void 0, function* () {
            if (_instance)
                return _instance;
            if (typeof fsConfig.local !== 'object') {
                logger.warn(`文件服务配置文件中没有指定本地文件服务信息`);
                return false;
            }
            const lfsConfig = fsConfig.local;
            _instance = new Context();
            initRootDir(_instance, lfsConfig);
            initThumb(_instance, lfsConfig);
            if (!(yield initDomains(_instance, lfsConfig))) {
                logger.warn(`文件服务初始化域失败`);
                return false;
            }
            logger.info(`完成文件服务设置。`);
            return _instance;
        });
    }
    static insSync() {
        return _instance;
    }
}
exports.Context = Context;
Context.ins = Context.init;
