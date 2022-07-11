export declare class Context {
    appConfig: any;
    constructor(appConfig: any);
    get routerControllersPrefix(): any;
    get routerAuthPrefix(): any;
    get routerAuthTrustedHosts(): any[];
    get excelDomainName(): any;
    static init(appConfig: any): Promise<any>;
    static insSync(): any;
    static ins: typeof Context.init;
}
