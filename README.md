# tms-koa

基于`koa`的轻量级快速开发框架，包含 MVC 中的 M 和 C 两部分，适合于实现 API 服务和前后端彻底分离的应用。

内置基于 access_token 的访问鉴权机制，更容易实现 API 调用的负载分担。

内置通过连接池访问 MySQL 数据库，支持进行读写分离。内置 SQL 语句的封装，内置 escape 防止 sql 注入。目前 where 条件中，exists，and，or 形成的 sql 不会进行 escape 处理，需要在外部自行处理。select 中的 fields 和 table 未进行 escape 处理，不能够直接使用用户输入的内容作为字段名和表名。orderby 和 groupby 未做 escape 处理，不能够直接使用用户输入。

内置支持上传文件。

# 安装

`npm install tms-koa --save`

注意：tms_db，mongodb，mongoose，redis 这 4 个依赖包采用`peerDependencies`，不会进行自动安装，如果需要使用可以手动安装。tms-db 的依赖包 mysql 和 better-sqlite3 采用`peerDependencies`，不会进行自动安装，如果需要使用可以手动安装。

# 测试

安装`pm2`（如果没装过）

```
cnpm i pm2 -g
```

通过`pm2`启动

```
npm run pm2
```

启动 Redis 和 MongoDb

```
docker-compose up -d
```

发送获得 token 的请求

```
http://localhost:3001/auth/authorize
```

发送调用 api 的请求

```
http://localhost:3001/api/tryGet?access_token=&value=hello
```

# 建立新应用

## 配置信息

在项目的根目录下建立文件`/config/app.js`，指定下列信息：

```javascript
module.exports = {
  port: 3000,
  name: 'tms-koa-0',
  router: {
    auth: {
      prefix: '', // 接口调用url的前缀
    },
    controllers: {
      prefix: '', // 接口调用url的前缀，例如：/api
    },
  },
  auth: {
    captcha: { code: 'a1z9' },
    client: { accounts: [{ id: 1, username: 'user1', password: '123456' }] },
    jwt: {
      privateKey: 'tms-koa-secret',
      expiresIn: 7200,
    },
  },
  tmsTransaction: false,
}
```

### 路由（router）

`controllers`的`prefix` 在 url 中出现，例如：`http://localhost:3001/api/tryGet?value=hello`，但是不在 controller 的路径中出现，例如：controllers/main.js 为与 url 对应的控制器。

参考：https://www.npmjs.com/package/koa-router

### 认证（auth）

`auth`部分是可选的，如果不配置或者`disabled`设置为`true`，就不启动鉴权机制。

支持`jwt`和`redis`两种`token`认证机制，都支持用`disabled`关闭，若同时设置，`jwt`优先于`redis`。

### redis

在项目的根目录下建立文件`/config/redis.js`，指定下列 Redis 连接信息：

```javascript
module.exports = {
  disabled: false, // 可选项，不需要指定。主要用于开发调试阶段。
  master: {
    host: '127.0.0.1',
    port: 6379,
  },
}
```

参考：https://www.npmjs.com/package/redis

### 关系数据库（mysql 或 sqlite）

在项目的根目录下建立文件`/config/db.js`，指定下列 MySQL 或 Sqlite 数据库（可选）连接信息：

```javascript
module.exports = {
  mysql: {
    master: {
      connectionLimit: 10,
      host: '',
      port: '',
      user: '',
      password: '',
      database: '',
    },
    write: {
      connectionLimit: 10,
      host: '',
      port: '',
      user: '',
      password: '',
      database: '',
    },
  },
  sqlite: {
    path: '',
  },
}
```

参考：https://www.npmjs.com/package/mysql

参考：https://github.com/JoshuaWise/better-sqlite3/blob/HEAD/docs/api.md

### mongodb

在项目的根目录下建立文件`/config/mongodb.js`，指定下列 MongoDb 连接信息：

```js
module.exports = {
  disabled: false, // 可选项，不需要指定。主要用于开发调试阶段。
  master: {
    host, // 如果要连接复制集，这里是复制集节点的主机地址数组
    port: 27017, // 如果要连接复制集，这里是复制集节点的主机端口数组
    replicaSet, // 复制集的名称
  },
}
```

注意：如果项目要使用 mongodb，需要在项目中安装 mongodb 包。

### mongoose

在项目的根目录下建立文件`/config/mongoose.js`，指定下列 mongoose 连接信息：

```js
module.exports = {
  disabled: false, // 可选项，不需要指定。主要用于开发调试阶段。
  host,
  port: 27017,
  database: 'test',
}
```

注意：如果项目要使用 mongoose，需要在项目中安装 mongoose 包。

### 文件服务

文件管理，例如：保存上传文件

```javascript
module.exports = {
  local: {
    rootDir: 'files' // 指定保存文件的根目录
    database: {
      dialect: 'mongodb',
      database:'upload',
      file_table: 'files'
    },
    schemas: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      title: 'Json-Doc-File',
      description: 'tms-vue-finder file',
      properties: {
        comment: {
          type: 'string',
          minLength: 0,
          maxLength: 80,
          title: '说明1',
          attrs: {
            placeholder: '请输入说明',
            title: '说明1'
          }
        }
      }
    }
  }
}
```

tms-koa 支持保存上传文件的扩展信息。可以指定将信息保存在数据库中，例如：mongodb。指定的数据库需要在/config/mongodb.js 中存在。

## 启动代码

建立文件`app.js`（可根据需要自行命名）

```javascript
const { TmsKoa } = require('tms-koa')

const tmsKoa = new TmsKoa()

tmsKoa.startup()
```

可以在 startup 中添加其他中间件（middleware），例如：

控制器之前

```
tmsKoa.startup({beforeController:[]})
```

控制器之后

```
tmsKoa.startup({afterController:[]})
```

完成初始化，启动 http 和 https 端口之前

tmsKoa.startup({afterInit:function(context){}})

## API 代码

建立 controllers 目录防止 API 代码，参考内置模块控制器部分。

# 内置模块

## 认证机制

在项目的根目录下建立文件`/auth/client.js`，实现一个根据 http 请求 返回`Clinet`对象的方法。

通过调用`/auth/authorize`获得`access_token`，它的值和`client.js`返回的对象存在一一对应的关系。

获得的`access_token`会存储在 Redis 中，有效期是`7200`秒。格式为`应用名称`（app.js 中的 name），`内容名AccessToken`，`token字符串`，`用户id字符串`（来源于 client.js 中指定的 id），中间用`:`分隔。

`tms-koa-0:AccessToken:c89d35281105456babd15d94831424c7:userid`

> 利用这个机制可以用`tms-koa`实现一个基于 token 的 api 鉴权中心。

通过调用`/auth/client`用`access_token`获得用户信息。

详细说明参加：[访问控制](doc/访问控制.md)

## 控制器（API）

项目根目录下创建`controllers`目录，路径和 url 匹配

需要从 Ctrl 类继承。

```javascript
const { Ctrl, ResultData } = require('tms-koa')

class Main extends Ctrl {
  tmsRequireTransaction() {
    return {
      get: true,
    }
  }
  get() {
    return new ResultData('I am an api.')
  }
}
module.exports = Main
```

### 路由与控制器匹配规则

`tms-koa`会根据`url`自动匹配`/controllers`目录下的控制器文件。

路由格式：`http://yourhost/{prefix}/{controller}/{method}`

| 参数       | 说明                                                                                                                       |
| ---------- | -------------------------------------------------------------------------------------------------------------------------- |
| prefix     | `/config/app.js`文件中，`router/controlers/prefix`中指定的内容。                                                           |
| controller | 和`/controllers`目录下的文件对应。`main.js`作为目录中的默认控制，如果`url`匹配的是目录，`tms-koa`会尝试匹配`main.js`文件。 |
| method     | 匹配到的`Ctrl`对象的方法。                                                                                                 |

参考：`/lib/controller/router.js`文件。

## 模型（model）

项目根目录下创建`models`目录。

模型必须从 DbModel 继承。

必须在导出包中提供一个用户创建实例的`create`方法。`DbModel`类中已经内置一个创建实例的方法的`create`方法，它的子类可参照下面的例子进行调用。

```javascript
const { DbModel } = require('tms-koa')

class Template extends DbModel {
  constructor({ db = null, debug = false } = {}) {
    super('template', { db, debug })
  }
}

module.exports = { Template, create: Template.create.bind(Template) }
```

已经在 model 层中进行 escape 处理，防止 sql 注入。关于 escape 请参考：tms_db。

## 静态文件

项目根目录下创建`public`目录。

## 控制器守卫方法

在控制器类（Ctrl）中添加方法，说明需要在调用接口前执行的代码。

```javascript
async tmsBeforeEach(method) {
  // 返回ResultFault及其子类的对象，终止接口调用
  // return new ResultFault('发生错误')

  return true
}
```

## 文件上传和下载

domain bucket path

domain 和 bucket 对用户是不可见的？但是要直接访问呢？

需要在部署阶段创建程序运行后用到的`domain`，例如在`files`目录下创建`tests`目录，用于保存单元测试产生的文件。

在 controllers 目录创建文件 upload.js（可根据需要命名），用于上传文件。

```javascript
const { UploadCtrl } = require('tms-koa/lib/controller/fs')

class Upload extends UploadCtrl {
  constructor(...args) {
    super(...args)
  }
}

module.exports = Upload
```

上传文件 api：http://localhost:3001/api/fs/upload/plain

---

在 controllers 目录创建文件 browse.js（可根据需要命名），用于浏览文件。

```javascript
const { BrowseCtrl } = require('tms-koa/lib/controller/fs')

class Browse extends BrowseCtrl {
  constructor(...args) {
    super(...args)
  }
}

module.exports = Browse
```

## 记录日志

在启动代码中添加如下文件

```javascript
const log4jsConfig = require('./config/log4js')
const log4js = require('log4js')
log4js.configure(log4jsConfig)
```
