# tms-koa

#应用

/config/app.json

```
{
    "name":"" // 引用的名称，会用于redis中的key
}
```

#鉴权机制

获得 token

/auth/token

需要指定鉴权的方法，放在 auth 目录下 index.js，实现一个根据 request 返回 TmsClinet 对象的方法

返回 client 对象

需要 redis

#api 自动匹配

基于 koa 的 api 服务框架

需要从 api 类集成

需要放在 routers 目录下，路径和 url 匹配

routers

#连接 MySQL 数据库

支持读写分离

配置信息

/config/db.json

```
{
    "master": {
        "connectionLimit": 2,
        "host": "localhost",
        "port": "3306",
        "user": "root",
        "password": "",
        "database": "xxt"
    },
    "write": {
        "connectionLimit": 1,
        "host": "localhost",
        "port": "3306",
        "user": "root",
        "password": "",
        "database": "xxt"
    }
}
```

基于 token 的访问框架

指定路由

指定 MySQL 连接

指定 Redis 连接
