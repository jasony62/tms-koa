import { DbModel } from './model';
export declare class Transaction extends DbModel {
    constructor({ db, debug, userid }?: {
        db?: any;
        debug?: boolean;
        userid?: any;
    });
    get userid(): any;
    begin(proto: any): Promise<any>;
    end(transId: any): Promise<any>;
}
export declare class RequestTransaction extends Transaction {
    ctrl: any;
    constructor(ctrl: any, { db, debug, userid }: {
        db?: any;
        debug?: boolean;
        userid?: any;
    });
    begin(): Promise<any>;
}
