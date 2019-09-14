# tms-koa

基于 koa 的快速开发框架，包含 MVC 中的 M 和 C 两部分，适合于实现 API 服务。

内置基于 access_token 的访问鉴权机制。

内置通过连接池访问 MySQL 数据库，支持进行读写分离。内置 SQL 语句的封装。

为了运行系统需要安装 Redis。

# 配置信息

在项目的根目录下建立文件`/config/app.js`，指定下列信息：

```javascript
module.exports = {
  port: 3000,
  name: "tms-koa-0",
  router: {
    auth: {
      prefix: "" // 接口调用url的前缀
    },
    controllers: {
      prefix: "" // 接口调用url的前缀
    }
  }
}
```

https://www.npmjs.com/package/koa-router

在项目的根目录下建立文件`/config/redis.js`，指定下列 Redis 连接信息：

```javascript
module.exports = {
  host: "127.0.0.1",
  port: "6379"
}
```

https://www.npmjs.com/package/redis

在项目的根目录下建立文件`/config/db.js`，指定下列 MySQL 数据库连接信息：

```javascript
module.exports = {
  master: {
    connectionLimit: 10,
    host: "",
    port: "",
    user: "",
    password: "",
    database: ""
  },
  write: {
    connectionLimit: 10,
    host: "",
    port: "",
    user: "",
    password: "",
    database: ""
  }
}
```

https://www.npmjs.com/package/mysql

# 鉴权机制

在项目的根目录下建立文件`/auth/client.js`，实现一个根据 http 请求 返回`Clinet`对象的方法。

通过调用`/auth/token`获得`access_token`，它的值和`client.js`返回的对象存在一一对应的关系。

# 控制器（API）

项目根目录下创建`controllers`目录，路径和 url 匹配

需要从 Ctrl 类继承

# 模型（model）

项目根目录下创建`models`目录

需要从 DbModel 继承

# 静态文件

项目根目录下创建`public`目录
