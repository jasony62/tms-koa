import { UploadCtrl } from './upload';
import { ResultData, ResultFault } from '../../response';
export declare class ImageCtrl extends UploadCtrl {
    uploadBase64(): Promise<ResultData | ResultFault>;
}
