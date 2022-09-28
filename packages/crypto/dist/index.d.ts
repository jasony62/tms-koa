declare type returnType = [boolean, string];
declare type accountInfoType = {
    username: string;
    password: string;
    adc?: any;
};
declare type returnAccountType = [boolean, accountInfoType | string];
declare type ctxType = {
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
