declare const log4js: any;
declare const logger: any;
declare const PromClient: any;
declare const Registry: any;
declare const ProfileCollector: any;
declare function startSystemProfile(config: any): Promise<boolean>;
declare let _instance: any;
declare class Context {
    register: any;
    constructor(register: any);
    static init(metricsConfig: any): Promise<any>;
    static insSync(): any;
    static ins: typeof Context.init;
}
