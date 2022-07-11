import { BaseCtrl } from './base';
import { ResultData, ResultFault } from '../../response';
export declare class ManageCtrl extends BaseCtrl {
    list(): Promise<ResultData | ResultFault>;
}
