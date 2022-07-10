export declare class Context {
    constructor();
    getSocket(id: any): any;
    getHttpsSocket(id: any): any;
    static init(pushConfig: any): Promise<any>;
    static ins: typeof Context.init;
}
