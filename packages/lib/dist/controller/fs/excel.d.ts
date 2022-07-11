export declare class ExcelCtrl {
    fsContext: any;
    domain: any;
    _export(columns: any, datas: any, fileName: any, options: any): any[];
    static init: (string | boolean)[] | (boolean | ExcelCtrl)[];
    static export: (columns: any, datas: any, fileName?: string, options?: {}) => any[];
}
