export declare class Context {
    definition: any;
    apis: any;
    constructor(definition: any, apis: any);
    static init(swaggerConfig: any): Promise<any>;
    static insSync(): any;
    static ins: typeof Context.init;
}
