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
const logger = log4js.getLogger('tms-koa-redis');
const uuidv4 = require('uuid').v4;
const { AppContext } = require('../app').Context;
const { auth: authConfig } = AppContext.insSync();
if (!authConfig) {
    let msg = '没有设置启用认证令牌参数';
    logger.error(msg);
    throw new Error(msg);
}
const redisConfig = authConfig.redis;
const EXPIRE_IN = redisConfig.expiresIn || 3600;
const INS_ID = redisConfig.prefix || 'tms-koa-token';
class TokenInRedis {
    constructor(redisClient) {
        this.redisClient = redisClient;
    }
    static create() {
        const { RedisContext } = require('../app').Context;
        return RedisContext.ins(redisConfig).then((redisContext) => new TokenInRedis(redisContext.redisClient));
    }
    quit() {
    }
    store(token, clientId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            let createAt = Math.floor(Date.now() / 1000);
            let keyByToken = this.getKey(token);
            let keyByClientId = this.getKey(null, clientId);
            const _store = (key, _data) => {
                return new Promise((resolve, reject) => {
                    this.redisClient
                        .set(key, JSON.stringify(_data))
                        .then((r) => {
                        return this.expire(null, null, key);
                    })
                        .then((r) => resolve(r))
                        .catch((e) => {
                        logger.error(e);
                        return reject('redis store error : redis error');
                    });
                });
            };
            yield _store(keyByToken, { expireAt: createAt + EXPIRE_IN, data });
            yield _store(keyByClientId, { expireAt: createAt + EXPIRE_IN, token, data });
            return EXPIRE_IN;
        });
    }
    expire(token = null, clientId = null, _key = null) {
        return __awaiter(this, void 0, void 0, function* () {
            const _expire = (key) => {
                return new Promise((resolve, reject) => {
                    this.redisClient
                        .expire(key, EXPIRE_IN)
                        .then((r) => {
                        return resolve(EXPIRE_IN);
                    })
                        .catch((e) => {
                        logger.error(e);
                        return reject('redis expire error : redis error');
                    });
                });
            };
            let key, rst;
            if (token) {
                key = this.getKey(token);
                rst = yield _expire(key);
            }
            if (clientId) {
                key = this.getKey(null, clientId);
                rst = yield _expire(key);
            }
            if (_key) {
                key = this.getKey(null, null, _key);
                rst = yield _expire(key);
            }
            return rst;
        });
    }
    del(token = null, clientId = null) {
        return __awaiter(this, void 0, void 0, function* () {
            let key, rst;
            if (token) {
                key = this.getKey(token);
                rst = yield this.redisClient.del(key);
            }
            if (clientId) {
                key = this.getKey(null, clientId);
                rst = yield this.redisClient.del(key);
            }
            return rst;
        });
    }
    get(token = null, clientId = null) {
        return __awaiter(this, void 0, void 0, function* () {
            let key = this.getKey(token, clientId);
            return this.redisClient
                .get(key)
                .catch((e) => {
                logger.error(e);
                return Promise.reject('access get error:redis error');
            })
                .then((r) => {
                if (!r)
                    return r;
                else
                    return JSON.parse(r);
            });
        });
    }
    ttl(token = null, clientId = null) {
        let key = this.getKey(token, clientId);
        return new Promise((resolve, reject) => {
            this.redisClient
                .ttl(key)
                .then((r) => {
                return resolve(r);
            })
                .catch((err) => {
                logger.error(err);
                return reject('redis ttl error : redis error');
            });
        });
    }
    getKey(token = null, clientId = null, key = null) {
        let returnKey;
        if (key) {
            returnKey = key;
        }
        else if (token) {
            returnKey = `${INS_ID}:AccessToken:${token}`;
        }
        else if (clientId) {
            returnKey = `${INS_ID}:ClientId:${clientId}`;
        }
        else {
            throw new Error('参数缺失');
        }
        return returnKey;
    }
}
class Token {
    static create(tmsClient) {
        return __awaiter(this, void 0, void 0, function* () {
            const tokenRedis = yield TokenInRedis.create();
            if (false === tokenRedis)
                return [false, '连接Redis服务失败'];
            const oldClientInfo = yield tokenRedis.get(null, tmsClient.id);
            if (oldClientInfo && tmsClient.allowMultiLogin === true) {
                const token = yield multiLogin(oldClientInfo.token, tokenRedis);
                if (token[0] === true) {
                    return [true, token[1]];
                }
            }
            if (oldClientInfo) {
                yield tokenRedis.del(oldClientInfo.token, tmsClient.id);
            }
            const newToken = uuidv4().replace(/-/g, '');
            const expireIn = yield tokenRedis.store(newToken, tmsClient.id, tmsClient.toPlainObject());
            tokenRedis.quit();
            return [
                true,
                {
                    access_token: newToken,
                    expire_in: expireIn,
                },
            ];
        });
    }
    static fetch(token) {
        return __awaiter(this, void 0, void 0, function* () {
            let tokenRedis = yield TokenInRedis.create();
            if (false === tokenRedis)
                return [false, '连接Redis服务失败'];
            try {
                let oResult = yield tokenRedis.get(token);
                if (!oResult) {
                    return [false, '没有找到和access_token匹配的数据'];
                }
                let oTmsClient = require('./client').createByData(oResult.data);
                return [true, oTmsClient];
            }
            catch (e) {
                return [false, e];
            }
            finally {
                tokenRedis.quit();
            }
        });
    }
    static expire(token, tmsClient) {
        return __awaiter(this, void 0, void 0, function* () {
            let tokenRedis = yield TokenInRedis.create();
            if (false === tokenRedis)
                return [false, '连接Redis服务失败'];
            try {
                const expire_in = yield tokenRedis.expire(token, tmsClient.id);
                return [true, expire_in];
            }
            catch (e) {
                return [false, e];
            }
            finally {
                tokenRedis.quit();
            }
        });
    }
}
function multiLogin(token, tokenRedis) {
    return __awaiter(this, void 0, void 0, function* () {
        const expireIn = yield tokenRedis.ttl(token);
        if (expireIn < 60)
            return [false, '即将过期'];
        return [true, { access_token: token, expire_in: expireIn }];
    });
}
module.exports = Token;
