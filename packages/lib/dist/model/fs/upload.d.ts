export declare class Upload {
    fs: any;
    constructor(fs: any);
    get rootDir(): any;
    get domain(): any;
    get thumbWidth(): any;
    get thumbHeight(): any;
    autodir(): any;
    autoname(): any;
    storename(ext: any): any;
    publicPath(fullpath: any): any;
    makeThumb(filepath: any, isRelative?: boolean): Promise<false | {
        path: any;
        size: any;
        width: any;
        height: any;
    }>;
}
export declare class UploadPlain extends Upload {
    constructor(fs: any);
    store(file: any, dir: any, forceReplace?: string): Promise<any>;
    storeByUrl(fileUrl: any, dir: any, forceReplace?: string, fileName?: string, axiosInstance?: any): Promise<any>;
}
export declare class UploadImage extends Upload {
    constructor(fs: any);
    storeBase64(base64Content: any, dir: any, forceReplace?: string): any;
    storeByUrl(): void;
}
