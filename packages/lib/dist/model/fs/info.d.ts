export declare class Info {
    domain: any;
    handler: any;
    constructor(domain: any, handler: any);
    get schemas(): any;
    set(path: any, info: any): Promise<any>;
    get(path: any): Promise<any>;
    list(query: any, skip: any, limit: any): Promise<any>;
    static init: (domain: any) => Promise<any>;
}
