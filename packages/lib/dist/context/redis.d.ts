export declare class Context {
    redisClient: any;
    constructor(redisClient: any);
    static connect(url: any): Promise<any>;
    static ins(config: any, name?: any): Promise<any>;
    static init(config: any): Promise<any>;
    static redisClient(name?: string, duplicate?: boolean): Promise<any>;
}
