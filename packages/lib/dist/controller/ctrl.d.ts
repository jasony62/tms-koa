export declare class Ctrl {
    bucket: string;
    constructor(ctx: any, client: any, dbContext: any, mongoClient: any, pushContext: any);
    get request(): any;
    get client(): any;
    get dbContext(): any;
    get mongoClient(): any;
    get db(): any;
    get ctx(): any;
    get socket(): any;
    model(name: any): any;
    localDate(ts?: number): Date;
}
