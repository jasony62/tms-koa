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
const _ = require('lodash');
const log4js = require('@log4js-node/log4js-api');
const logger = log4js.getLogger('tms-koa-swagger');
const Router = require('@koa/router');
const { AppContext, MetricsContext } = require('../app').Context;
let prefix = _.get(AppContext.insSync(), ['router', 'metrics', 'prefix'], '/metrics');
if (prefix && !/^\//.test(prefix))
    prefix = `/${prefix}`;
let msg = `启用监控服务，地址前缀：${prefix}。`;
logger.info(msg);
const router = new Router();
router.get(prefix, (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    let { request, response } = ctx;
    const metricsContext = MetricsContext.insSync();
    const metrics = yield metricsContext.register.metrics();
    response.body = metrics;
}));
module.exports = router;
