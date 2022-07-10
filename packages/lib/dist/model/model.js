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
exports.DbModel = void 0;
class Model {
}
const DEBUG_MODE = Symbol('debug_mode');
const DB_INSTANCE = Symbol('db_instance');
const TABLE_NAME = Symbol('table_name');
const TABLE_ID = Symbol('table_id');
const TABLE_AUTO_INC_ID = Symbol('table_auto_inc_id');
function _makeWhere(dbSqlAction, whereParts) {
    if (whereParts && Array.isArray(whereParts)) {
        whereParts.forEach((part) => {
            let [method, ...args] = part;
            if (dbSqlAction.where[method]) {
                dbSqlAction.where[method].apply(dbSqlAction.where, args);
            }
        });
    }
    return dbSqlAction;
}
class DbModel extends Model {
    constructor(table, { id = 'id', autoIncId = true, debug = false, db = null } = {}) {
        super();
        this[TABLE_NAME] = table;
        this[TABLE_ID] = id;
        this[TABLE_AUTO_INC_ID] = autoIncId;
        this[DEBUG_MODE] = debug;
        this[DB_INSTANCE] = db;
    }
    static create({ db = null, debug = false }) {
        if (db === null) {
            const { DbServer } = require('tms-db');
            db = new DbServer({ debug });
        }
        let dbModelIns = Reflect.construct(this, [{ db, debug }]);
        return dbModelIns;
    }
    model(name) {
        let path = `${process.cwd()}/models/${name}`;
        let model = require(path).create({ db: this[DB_INSTANCE] });
        return model;
    }
    get table() {
        return this[TABLE_NAME];
    }
    get id() {
        return this[TABLE_ID];
    }
    get isAutoIncId() {
        return this[TABLE_AUTO_INC_ID];
    }
    get debug() {
        return this[DEBUG_MODE];
    }
    get execSqlStack() {
        return this[DB_INSTANCE].execSqlStack;
    }
    select(fields, wheres, { limit = null, orderby = null, groupby = null } = {}, { fnForEach, fnMapKey, }) {
        return __awaiter(this, void 0, void 0, function* () {
            let dbSelect = this.db.newSelect(this.table, fields);
            if (Array.isArray(limit) && limit.length === 2)
                dbSelect.limit(...limit);
            if (typeof orderby === 'string')
                dbSelect.order(orderby);
            if (typeof groupby === 'string')
                dbSelect.group(groupby);
            _makeWhere(dbSelect, wheres);
            let rows = yield dbSelect.exec();
            if (rows && rows.length) {
                if (typeof fnForEach === 'function')
                    rows.forEach((r) => fnForEach(r));
                if (typeof fnMapKey === 'function') {
                    let map = new Map();
                    rows.forEach((r) => {
                        map.set(fnMapKey(r), r);
                    });
                    return map;
                }
            }
            return rows;
        });
    }
    selectOne(fields, wheres) {
        return __awaiter(this, void 0, void 0, function* () {
            let dbSelect = this.db.newSelectOne(this.table, fields);
            _makeWhere(dbSelect, wheres);
            let row = yield dbSelect.exec();
            return row;
        });
    }
    insert(data) {
        return __awaiter(this, void 0, void 0, function* () {
            let dbIns = this.db.newInsert(this.table, data);
            let idOrRows = yield dbIns.exec({ isAutoIncId: this.isAutoIncId });
            return idOrRows;
        });
    }
    updateById(id, data) {
        return __awaiter(this, void 0, void 0, function* () {
            let dbUpd = this.db.newUpdate(this.table, data);
            dbUpd.where.fieldMatch(this.id, '=', id);
            let rows = yield dbUpd.exec();
            return rows;
        });
    }
    get db() {
        return this[DB_INSTANCE];
    }
    set db(db) {
        this[DB_INSTANCE] = db;
    }
    end(done) {
        if (this[DB_INSTANCE])
            this[DB_INSTANCE].end(done);
        else if (done && typeof done === 'function')
            done();
    }
}
exports.DbModel = DbModel;
