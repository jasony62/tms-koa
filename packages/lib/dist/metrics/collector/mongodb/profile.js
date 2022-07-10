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
exports.ProfileCollector = void 0;
const log4js = require('@log4js-node/log4js-api');
const logger = log4js.getLogger('tms-koa-metrics');
const { Counter } = require('prom-client');
function fetch(client, dbName, beforeLatestTs) {
    return __awaiter(this, void 0, void 0, function* () {
        const db = yield client.db(dbName);
        let docs = yield db
            .collection('system.profile')
            .find({ ts: { $gt: beforeLatestTs }, ns: { $not: /system.profile/ } }, { ns: 1, ts: 1, millis: 1 })
            .toArray();
        let mapNsData = new Map();
        let latestTs = beforeLatestTs;
        if (docs && docs.length > 0) {
            latestTs = docs[docs.length - 1]['ts'];
            docs.forEach((doc) => {
                let nsData = mapNsData.get(doc.ns);
                if (!nsData) {
                    nsData = { millis: 0, total: 0 };
                    mapNsData.set(doc.ns, nsData);
                }
                nsData.millis += doc.millis;
                nsData.total++;
            });
        }
        return { latestTs, data: mapNsData };
    });
}
const OnlyOnceFetch = {
    latestTs: -1,
    latestPromise: null,
    run: (host) => __awaiter(void 0, void 0, void 0, function* () {
        if (host.latestTs != OnlyOnceFetch.latestTs) {
            OnlyOnceFetch.latestPromise = new Promise((resolve) => __awaiter(void 0, void 0, void 0, function* () {
                let result = yield fetch(host.client, host.dbName, host.latestTs);
                host.latestTs = new Date(result.latestTs);
                resolve(result);
            }));
            OnlyOnceFetch.latestTs = host.latestTs;
        }
        return OnlyOnceFetch.latestPromise;
    }),
};
class ProfileCollector {
    constructor(client, dbName, prefix) {
        this.client = client;
        this.dbName = dbName;
        this.prefix = prefix;
        this.latestTs = new Date(0);
    }
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            const MetricsContext = require('../../../context/metrics').Context;
            const metricsContext = MetricsContext.insSync();
            let prefix = this.prefix ? this.prefix : 'tms';
            const total = new Counter({
                name: `${prefix}_mongodb_system_profile_total`,
                help: '慢查询累积发生的次数',
                labelNames: ['ns'],
                registers: [metricsContext.register],
                collect: () => __awaiter(this, void 0, void 0, function* () {
                    yield OnlyOnceFetch.run(this).then((result) => {
                        result.data.forEach((nsData, ns) => {
                            total.labels({ ns }).inc(nsData.total);
                        });
                    });
                }),
            });
            const mills = new Counter({
                name: `${prefix}_mongodb_system_profile_millis`,
                help: '慢查询累积执行的时间',
                labelNames: ['ns'],
                registers: [metricsContext.register],
                collect: () => __awaiter(this, void 0, void 0, function* () {
                    yield OnlyOnceFetch.run(this).then((result) => {
                        result.data.forEach((nsData, ns) => {
                            mills.labels({ ns }).inc(nsData.millis);
                        });
                    });
                }),
            });
        });
    }
}
exports.ProfileCollector = ProfileCollector;
