# 配置连接参数

```js
export default {
  disabled: true, // 可省略
  master: {
    user: 'root',
    password: 'root',
    host: 'localhost',
    port: 27017,
    // replicaSet: 'devrs',
    authSource,
    maxPoolSize,
    authMechanism,
    connectionString, // 连接中直接指定的内容，需要包含host:port
    connectionOptions,
  },
}
```

| 连接参数      | 说明                                                                                                                                                                                                                                             |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| maxPoolSize   | The maximum number of connections in the connection pool. The default value is 100.                                                                                                                                                              |
| authSource    | Specify the database name associated with the user's credentials. If authSource is unspecified, authSource defaults to the defaultauthdb specified in the connection string. If defaultauthdb is unspecified, then authSource defaults to admin. |
| authMechanism | Specify the authentication mechanism that MongoDB uses to authenticate the connection. If you don't specify an authMechanism but provide user credentials, MongoDB attempts to use SCRAM-SHA-256. If this fails, it falls back to SCRAM-SHA-1.   |

|

控制器中直接获得 mongoClient 连接

> this.mongoClient

> this.mongoClient.db(dbName).collection(clName)

参考：

https://www.mongodb.com/docs/manual/reference/connection-string/
