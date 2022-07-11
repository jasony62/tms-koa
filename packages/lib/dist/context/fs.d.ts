export declare class Context {
    domains: any;
    isValidDomain(name: any): any;
    getDomain(name: any): any;
    checkClientACL(client: any, domain: any, bucket: any, path: any, request: any): Promise<any>;
    static init(fsConfig: any): Promise<any>;
    static insSync(): any;
    static ins: typeof Context.init;
}
