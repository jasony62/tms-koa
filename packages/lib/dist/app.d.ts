declare const Koa: any;
declare const Context: any;
declare function loadConfig(name: any, defaultConfig?: any): any;
declare type KoaMiddleware = (ctx: any, next: Function) => void;
declare class TmsKoa extends Koa {
    constructor(options: any);
    startup({ beforeController, afterController, afterInit, }: {
        beforeController: KoaMiddleware[];
        afterController: KoaMiddleware[];
        afterInit: (context: any) => void;
    }): Promise<void>;
}
export { TmsKoa, Context, loadConfig };
