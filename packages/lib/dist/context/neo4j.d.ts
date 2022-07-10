declare class Neo4jConfig {
    host: string;
    port: number;
    user: string;
    password: string;
    constructor(config: object);
}
declare class Context {
    private static _instancesByUri;
    private static _instancesByName;
    private _name;
    private _driver;
    constructor(name: any, driver: any);
    session(): Promise<any>;
    close(): Promise<any>;
    static ins(config?: Neo4jConfig | string, name?: string): Promise<Context>;
    static init(config: object): Promise<any>;
    static close(): Promise<any[]>;
}
export { Neo4jConfig, Context };
