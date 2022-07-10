declare class Model {
}
export declare class DbModel extends Model {
    constructor(table: any, { id, autoIncId, debug, db }?: {
        id?: string;
        autoIncId?: boolean;
        debug?: boolean;
        db?: any;
    });
    static create({ db, debug }: {
        db?: any;
        debug?: boolean;
    }): any;
    model(name: string): any;
    get table(): any;
    get id(): any;
    get isAutoIncId(): any;
    get debug(): any;
    get execSqlStack(): any;
    select(fields: any, wheres: any, { limit, orderby, groupby }: {
        limit?: any;
        orderby?: any;
        groupby?: any;
    }, { fnForEach, fnMapKey, }: {
        fnForEach: (any: any) => void;
        fnMapKey: (any: any) => void;
    }): Promise<any>;
    selectOne(fields: any, wheres: any): Promise<any>;
    insert(data: any): Promise<any>;
    updateById(id: any, data: any): Promise<any>;
    get db(): any;
    set db(db: any);
    end(done: any): void;
}
export {};
