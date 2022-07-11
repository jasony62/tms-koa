export declare class ResultBase {
    msg: string;
    code: number;
    result: any;
    constructor(result: any, msg: any, code: any);
}
export declare class ResultData extends ResultBase {
    constructor(result?: any, msg?: string, code?: number);
}
export declare class ResultFault extends ResultBase {
    constructor(msg?: string, code?: number, result?: any);
}
export declare class ResultObjectNotFound extends ResultFault {
    constructor(msg?: string, result?: any, code?: number);
}
export declare class AccessTokenFault extends ResultBase {
    constructor(msg?: string, code?: number, result?: any);
}
