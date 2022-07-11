export declare class LocalFS {
    constructor(domain: any, bucket?: string);
    getFsContext(): any;
    get appRootDir(): any;
    get rootDir(): any;
    get thumbDir(): any;
    get thumbWidth(): any;
    get thumbHeight(): any;
    get domain(): any;
    fullpath(filename: any, isRelative?: boolean): any;
    publicPath(fullpath: any): any;
    relativePath(fullpath: any): any;
    thumbPath(filename: any, isRelative?: boolean): any;
    existsSync(filename: any, isRelative?: boolean): any;
    list(dir?: string): {
        files: any[];
        dirs: any[];
    };
    write(filename: any, content: any, isRelative?: boolean, options?: {}): any;
    writeStream(filename: any, file: any, isRelative?: boolean): Promise<unknown>;
    remove(filename: any, isRelative?: boolean): void;
}
