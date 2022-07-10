"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccessTokenFault = exports.ResultObjectNotFound = exports.ResultFault = exports.ResultData = exports.ResultBase = void 0;
class ResultBase {
    constructor(result, msg, code) {
        this.msg = msg;
        this.code = code;
        if (result !== undefined && result !== null)
            this.result = result;
    }
}
exports.ResultBase = ResultBase;
class ResultData extends ResultBase {
    constructor(result = null, msg = '正常', code = 0) {
        super(result, msg, code);
    }
}
exports.ResultData = ResultData;
class ResultFault extends ResultBase {
    constructor(msg = '操作无法完成', code = 10001, result = null) {
        super(result, msg, code);
    }
}
exports.ResultFault = ResultFault;
class ResultObjectNotFound extends ResultFault {
    constructor(msg = '指定的对象不存在', result = null, code = 10002) {
        super(msg, code, result);
    }
}
exports.ResultObjectNotFound = ResultObjectNotFound;
class AccessTokenFault extends ResultBase {
    constructor(msg = '', code = 20001, result = null) {
        super(result, msg, code);
    }
}
exports.AccessTokenFault = AccessTokenFault;
