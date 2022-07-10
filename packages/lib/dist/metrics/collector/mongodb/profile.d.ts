export declare class ProfileCollector {
    client: any;
    dbName: any;
    prefix: any;
    latestTs: any;
    constructor(client: any, dbName: any, prefix: any);
    run(): Promise<void>;
}
