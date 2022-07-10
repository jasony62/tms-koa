declare class Token {
    static create(tmsClient: any): Promise<(string | boolean | {
        access_token: any;
        expire_in: any;
    })[]>;
    static fetch(token: any): Promise<any[]>;
    static expire(token: any, tmsClient: any): Promise<any[]>;
}
export = Token;
