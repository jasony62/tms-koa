export declare class Client {
    constructor(id: any, data: any, isAdmin?: boolean, allowMultiLogin?: boolean);
    get id(): any;
    get data(): any;
    get isAdmin(): any;
    get allowMultiLogin(): any;
    toPlainObject(): {
        id: any;
        data: any;
        isAdmin: any;
        allowMultiLogin: any;
    };
    toString(): string;
}
export declare function createByData(oPlainData: any): Client;
