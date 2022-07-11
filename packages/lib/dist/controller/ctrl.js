"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Ctrl = void 0;
const API_FIELD_REQUEST = Symbol('request');
const API_FIELD_CLIENT = Symbol('client');
const API_FIELD_DB_CTX = Symbol('dbcontext');
const API_FIELD_MONGO_CLIENT = Symbol('mongoclient');
const API_FIELD_CTX = Symbol('ctx');
const API_FIELD_PUSH_CTX = Symbol('pushContext');
class Ctrl {
    constructor(ctx, client, dbContext, mongoClient, pushContext) {
        this[API_FIELD_REQUEST] = ctx.request;
        this[API_FIELD_CLIENT] = client;
        this[API_FIELD_DB_CTX] = dbContext;
        this[API_FIELD_MONGO_CLIENT] = mongoClient;
        this[API_FIELD_CTX] = ctx;
        this[API_FIELD_PUSH_CTX] = pushContext;
    }
    get request() {
        return this[API_FIELD_REQUEST];
    }
    get client() {
        return this[API_FIELD_CLIENT];
    }
    get dbContext() {
        return this[API_FIELD_DB_CTX];
    }
    get mongoClient() {
        return this[API_FIELD_MONGO_CLIENT];
    }
    get db() {
        return this.dbContext.db();
    }
    get ctx() {
        return this[API_FIELD_CTX];
    }
    get socket() {
        if (this[API_FIELD_PUSH_CTX] && this.request.query.socketid) {
            const { socketid } = this.request.query;
            if (this.ctx.protocol === 'https')
                return this[API_FIELD_PUSH_CTX].getHttpsSocket(socketid);
            else
                return this[API_FIELD_PUSH_CTX].getSocket(socketid);
        }
        return null;
    }
    model(name) {
        let path = `${process.cwd()}/models/${name}`;
        let model = require(path).create({ db: this.db });
        return model;
    }
    localDate(ts = Date.now()) {
        let d = new Date(ts);
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        return d;
    }
}
exports.Ctrl = Ctrl;
