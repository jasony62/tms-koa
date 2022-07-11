import { BaseCtrl } from './base';
import { ResultData } from '../../response';
export declare class BrowseCtrl extends BaseCtrl {
    getBizInfo(path: any): Promise<any>;
    list(): Promise<ResultData>;
}
