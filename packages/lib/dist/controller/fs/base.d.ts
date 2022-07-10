import { Ctrl } from '../ctrl';
import { ResultData, ResultFault } from '../../response';
export declare class BaseCtrl extends Ctrl {
    fsContext: any;
    domain: any;
    constructor(ctx: any, client: any, dbContext: any, mongoClient: any, pushContext: any);
    tmsBeforeEach(): Promise<true | ResultFault>;
    schemas(): Promise<ResultData | ResultFault>;
    setInfo(): Promise<ResultData | ResultFault>;
    _setFileInfo(fsInfo: any, path: any, info: any, setMD5?: string): Promise<any>;
    getFileMD5(path: any): Promise<unknown>;
    setInfos(): Promise<ResultData | ResultFault>;
}
