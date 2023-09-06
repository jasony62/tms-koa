type returnType = [boolean, string];
type accountInfoType = {
    username: string;
    password: string;
    adc?: any;
};
type returnAccountType = [boolean, accountInfoType | string];
type ctxType = {
    [key: string]: any;
};
declare class Encrypt {
    v1(text: string, key: string): returnType;
    v2(text: string): returnType;
}
declare class Decrypt {
    v1(text: string, key: string): returnType;
    v2(text: string): returnType;
}
export declare class Crypto {
    static encrypt: Encrypt;
    static decrypt: Decrypt;
}
export declare function encodeAccountV1(accountInfo: accountInfoType): returnAccountType;
export declare function decodeAccountV1(ctx: ctxType): returnAccountType;
export {};
