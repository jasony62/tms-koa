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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Info = void 0;
const lodash_1 = __importDefault(require("lodash"));
class MongodbInfo {
    constructor(mongoClient, database, collection) {
        this.mongoClient = mongoClient;
        this.database = database;
        this.collection = collection;
    }
    set(path, info) {
        return __awaiter(this, void 0, void 0, function* () {
            const cl = this.mongoClient.db(this.database).collection(this.collection);
            const beforeInfo = yield cl.find({ path }).toArray();
            if (beforeInfo.length <= 1) {
                const updatedInfo = lodash_1.default.omit(info, ['_id']);
                return cl
                    .updateOne({ path }, { $set: updatedInfo }, { upsert: true })
                    .then(() => info);
            }
            else {
                throw new Error(`数据错误，文件[${path}]有条信息数据`);
            }
        });
    }
    get(path) {
        return __awaiter(this, void 0, void 0, function* () {
            const client = this.mongoClient;
            const cl = client.db(this.database).collection(this.collection);
            const info = yield cl.findOne({ path });
            return info;
        });
    }
    list(query, skip, limit) {
        return __awaiter(this, void 0, void 0, function* () {
            const client = this.mongoClient;
            const cl = client.db(this.database).collection(this.collection);
            const result = {};
            result.files = yield cl
                .find(query)
                .skip(skip)
                .limit(limit)
                .toArray()
                .then((docs) => docs);
            result.total = yield cl.find(query).count();
            return result;
        });
    }
}
class Info {
    constructor(domain, handler) {
        this.domain = domain;
        this.handler = handler;
    }
    get schemas() {
        return this.domain.schemas;
    }
    set(path, info) {
        return __awaiter(this, void 0, void 0, function* () {
            info.domain = this.domain.name;
            return yield this.handler.set(path, info);
        });
    }
    get(path) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.handler.get(path);
        });
    }
    list(query, skip, limit) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!query)
                query = {};
            query.domain = this.domain.name;
            return yield this.handler.list(query, skip, limit);
        });
    }
}
exports.Info = Info;
Info.init = (function () {
    let _instance = new Map();
    return function (domain) {
        return __awaiter(this, void 0, void 0, function* () {
            if (_instance.has(domain.name))
                return _instance.get(domain.name);
            if (!domain.mongoClient ||
                !domain.database ||
                !domain.collection ||
                !domain.schemas)
                return false;
            const mongo = new MongodbInfo(domain.mongoClient, domain.database, domain.collection);
            const domainInfo = new Info(domain, mongo);
            _instance.set(domain.name, domainInfo);
            return domainInfo;
        });
    };
})();
