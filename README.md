# tms-koa

# 配置信息

在项目的根目录下建立文件`/config/app.js`，指定下列信息：

```javascript
module.exports = {
  port: "3000",
  name: "tms-koa-0"
}
```

#鉴权机制

在项目的根目录下建立文件`/auth/index.js`

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

/config/db.js

```javascript
module.exports = {
  master: {
    connectionLimit: 10,
    host: "localhost",
    port: "3306",
    user: "root",
    password: "",
    database: ""
  },
  write: {
    connectionLimit: 10,
    host: "localhost",
    port: "3306",
    user: "root",
    password: "",
    database: ""
  }
}
```

基于 token 的访问框架

指定路由

指定 MySQL 连接

指定 Redis 连接
