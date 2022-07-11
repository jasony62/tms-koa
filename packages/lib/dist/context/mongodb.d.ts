export declare class Context {
    static init(config: any): Promise<any>;
    static ins(config: any, name?: any): Promise<any>;
    static insSync(name: any): any;
    static mongoClient(name?: string): Promise<any>;
    static mongoClientSync(name?: string): any;
}
