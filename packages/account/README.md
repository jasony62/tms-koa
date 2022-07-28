# tms-koa-account

tms-koa 账号管理控制器插件

支持账号的增删改查操作。

# tms-koa 用户认证方法

./config/app.js

```
models/authenticate.js
module.exports = {
  auth: {
    client: {
      npm: {
        disabled: false,
        id: 'tms-koa-account',
        // module: '',
        authentication: 'models/authenticate',
        register: 'models/register',
      },
    },
  },
}
```

| 字段                      | 说明                                                         | 类型   | 必填 |
| ------------------------- | ------------------------------------------------------------ | ------ | ---- |
| client.npm.id             | 第三方模块                                                   | string | Y    |
| client.npm.module         | 登录注册方法的独立模块文件                                   | string | N\Y  |
| client.npm.authentication | 登录函数（如果没有module，应为模块文件，如果有module，为具体方法名） | string | N\Y  |
| client.npm.register       | 注册函数（如果没有module，应为模块文件，如果有module，为具体方法名） | string | N    |



# tms-koa 验证码方法

./config/app.js

```
models/captcha
module.exports = {
  auth: {
    captcha: {  // 验证码
      npm: {
        disabled: false,
        id: 'tms-koa-account',
        module: 'models/captcha', 
        checker: 'checkCaptcha',
        generator: "createCaptcha"
      },
    },
  },
}
```

| 字段                  | 说明                 | 类型   | 必填 |
| --------------------- | -------------------- | ------ | ---- |
| captcha.npm.module    | 验证码独立模块文件   | string | N\Y  |
| captcha.npm.checker   | 验证码检查函数（……） | string | N\Y  |
| captcha.npm.generator | 验证码生成函数（……） | string | N    |



# 账号管理配置文件

./config/account.js

```javascript
module.exports = {
  disabled: false,
  mongodb: {
    disabled: true,
    name: 'master',
    database: 'tms_account',
    collection: 'account',
    schema: { test: { type: 'string', title: '测试' } }, // 集合中要保留的账号信息字段
  },
  // redis: {
  //   name: master
  // }
  // accounts: [
  //   {
  //     id: 1,
  //     username: 'user1',
  //     password: 'user1',
  //     isAdmin: true,
  //     allowMultiLogin: true,
  //   },
  // ],
  // admin: { username: 'admin', password: 'admin' },
  // accountBeforeEach: "./accountBeforeEach.js", // 登录、注册 前置步骤，如：对账号密码解密等
  // accountBeforeEach: (ctx) => {
  //   const { decodeAccountV1 } = require('tms-koa-account/models/crypto')
  //   const rst = decodeAccountV1(ctx)
  //   if (rst[0] === false)
  //     return Promise.reject(rst[1])
  //   return Promise.resolve({ username: rst[1].username, password: rst[1].password })
  // },
  authConfig: {
    pwdErrMaxNum: 5, // int 密码错误次数限制 0 不限制
    authLockDUR: 20, // int 登录锁定时长 （秒）
    pwdStrengthCheck: {
      min: 8, // 密码最小长度
      max: 20, // 密码最大长度
      pwdBlack: ['P@ssw0rd'], // 密码黑名单
      containProjects: {
        mustCheckNum: 3,
        contains: ['digits', 'uppercase', 'lowercase', 'symbols'],
      }, // 是否包含数字、大写字母、小写字母、特殊字符, 至少满足其中length项
      hasSpaces: false, // 是否包含空格
      hasAccount: false,
      hasKeyBoardContinuousChar: false,
      // hasKeyBoardContinuousCharSize: 4
    },
  },
  // captchaConfig: {
  //   disabled: false,   // boolean 是否启用验证码
  //   storageType: "lowdb", // 验证码存储方式  lowdb | redis
  //   masterCaptcha: "aabb",   // string 万能验证码
  //   codeSize: 4, //验证码长度  默认4
  //   alphabetType: "number,upperCase,lowerCase", // 字母表生产类型 默认 数字+大写字母+小写字母
  //   alphabet: "1234567890" // 与alphabetType不可公用，优先级大于alphabetType
  //   expire: 300, // 过期时间 s 默认300
  // }
}

```

| 字段              | 说明                                      | 类型            | 必填 |
| ----------------- | ----------------------------------------- | --------------- | ---- |
| mongodb           | 存储账号数据的 MongoDB 设置               | object          | 否   |
| mongodb.name      | `tms-koa`配置的`MongoDB`连接名称。        | object          | 否   |
| mongodb.schema    | 账号集合中中要保留的账号信息字段          | object          | 否   |
| accounts          | 存储账号数据的数据                        | object[]        | 否   |
| admin             | 管理员账号                                | object          | 否   |
| accountBeforeEach | 登录、注册 前置步骤，如：对账号密码解密等 | string\function | 否   |
| authConfig        | 登录或注册时的检查                        | object          | 否   |
| captchaConfig     | 验证码生成配置                            | object          | 否   |

# authConfig 字段说明

| 字段             | 说明                                 | 类型   | 必填 |
| ---------------- | ------------------------------------ | ------ | ---- |
| pwdErrMaxNum     | 密码错误次数限制 0 不限制            | int    | 否   |
| authLockDUR      | 密码错误次数超限后登录锁定时长（秒） | int    | 否   |
| pwdStrengthCheck | 注册时密码强度校验                   | object | 否   |

# pwdStrengthCheck 字段说明

| 字段                          | 说明                             | 类型     | 必填 |
| ----------------------------- | -------------------------------- | -------- | ---- |
| min                           | 密码最小长度                     | int      | 否   |
| max                           | 密码最大长度                     | int      | 否   |
| pwdBlack                      | 密码黑名单                       | object[] | 否   |
| containProjects               | 密码中需要包含的字符类型         | object   | 否   |
| hasSpaces                     | 密码中是否可以包含空格           | boolean  | 否   |
| hasAccount                    | 密码中是否可以包含账号           | boolean  | 否   |
| hasKeyBoardContinuousChar     | 密码中是否可以包含连续键盘字符   | boolean  | 否   |
| hasKeyBoardContinuousCharSize | 判断密码中包含连续键盘字符的长度 | boolean  | 否   |

`mongodb`优先于`accounts`设置。

# captchaConfig字段说明

| 字段          | 说明                                                         | 类型    | 默认                       | 必填 |
| ------------- | ------------------------------------------------------------ | ------- | -------------------------- | ---- |
| disabled      | 是否启用验证码                                               | boolean | false                      | 否   |
| storageType   | 验证码存储方式 支持 redis、lowdb                             | string  | lowdb                      | 否   |
| masterCaptcha | 万能验证码                                                   | string  |                            | 否   |
| codeSize      | 验证码长度                                                   | int     | 4                          | 否   |
| alphabetType  | 验证码字母表类型 与 alphabetType 不可公用，优先级大于 alphabetType | string  | number,upperCase,lowerCase | 否   |
| expire        | 验证码有效期（s）                                            | int     | 300                        | 否   |

# 密码强度校验类

```javascript
const { PasswordProcess } = require('../models/processpwd')
const pwdProcess = new PasswordProcess(password)
pwdProcess.options = { account }
const checkRst = pwdProcess.pwdStrengthCheck()
```

# 账号对象固定字段

| 字段            | 说明                 | 类型     | 必填 |
| --------------- | -------------------- | -------- | ---- |
| \_id            | 系统自动生成 id      | ObjectId | 是   |
| username        | 用户账户名，不可重复 | string   | 是   |
| nickname        | 用户昵称             | string   | 是   |
| password        | 系统自动加密         | string   | 是   |
| salt            | 系统自动生成         | string   | 是   |
| pwdErrNum       | 密码错误次数         | int      | 否   |
| authLockExp     | 授权锁截止时间       | string   | 否   |
| isAdmin         | 是否为管理员         | boolean  | 否   |
| allowMultiLogin | 是否允许多点登录     | boolean  | 否   |

# 演示

## 密码

### 获取验证码

> curl 'http://localhost:3001/auth/captcha?appid=oauth&captchaid=aly21'

附加参数

```
  storageType: "lowdb", // 验证码存储方式  lowdb | redis
  codeSize: 4, //验证码长度  默认4
  alphabetType: "number,upperCase,lowerCase", // 字母表类型 默认 数字+大写字母+小写字母
  alphabet: "1234567890" // 与alphabetType不可公用，优先级大于alphabetType
  expire: 300, // 过期时间 s 默认300,
  returnType: "text" // 返回验证码类型 text | image  默认 image
```

### 登录

> curl -H "Content-Type: application/json" -X POST -d '{ "appid":"oauth","captchaid":"aly21","code":"dha2c","username": "admin", "password":"admin" }' http://localhost:3001/auth/authenticate

### 获取用户列表

> curl 'http://localhost:3001/api/account/admin/list?access_token='

### 创建账号

> curl -H "Content-Type: application/json" -X POST -d '{"username": "user1", "password":"user1", "nickname": "user1" }' 'http://localhost:3001/api/account/admin/create?access_token='

### 检验验证码

> curl 'http://localhost:3001/auth/checkCaptcha?appid=oauth&captchaid=aly22&code=cxpr6'

附加参数

```
strictMode: "N" // Y | N 检验大小写
```

### 用户注册 

> curl -H "Content-Type: application/json" -X POST -d '{"username":"user1","password":"user1","appid":"oauth","captchaid":"aly21","code":"aabb"}' 'http://localhost:3001/auth/register'


# 启动 tms-koa-account 服务

## 配置

./config/app.js

```javascript
module.exports = {
  port: process.env.APP_PORT2 || 3002,
  name: 'tms-koa-account-demo2',
  router: {
    auth: {
      // prefix: 'auth' // 接口调用url的前缀
    },
  },
}
```

./config/account.js

同上【账号管理配置文件】

## 启动服务

```javascript
const log4js = require('log4js')
log4js.configure({
  appenders: {
    consoleout: { type: 'console' },
  },
  categories: {
    default: { appenders: ['consoleout'], level: 'debug' },
  },
})

const { TmsKoaAccount } = require('tms-koa-account')

const tmsKoaAccount = new TmsKoaAccount()

tmsKoaAccount.startup()
```

## TMS_KOA_ACCOUNT API

### 生成验证码 GET|POST

> curl 'http://localhost:3002/auth/captcha?appid=pool&captchaid=aly21'
>
> 附件参数
>
> "alphabet":"QWERTYUIIIOPASDFGHJKL", // 验证码字母表与alphabetType不可公用，优先级大于alphabetType
>
> "expire":200, // 过期时间 s 默认300
>
> "alphabetType":"number,upperCase,lowerCase",  // 字母表生产类型 默认 数字+大写字母+小写字母
>
> "codeSize":4, //验证码长度  默认4
>
> "storageType":"redis", // 验证码存储方式  lowdb | redis
>
> "returnType":"text" // 返回验证码类型 text | image  默认 image

### 验证验证码 GET | POST

> curl 'localhost:3002/auth/checkCaptcha?appid=order&captchaid=aly22&code=aabb'
>
> 附件参数
>
> strictMode: "N"  // Y | N 检验大小写

# 加密模块

tms-koa-account/models/crypto.js
## 示例

```javascript
const { Crypto, encodeAccountV1, decodeAccountV1 } = require('./models/crypto')

const username = "user135"
const password = "8811aa,,"
// const key = "1234567890123adc"

// const endcode = Crypto.encrypt.v1(password, key)
// console.log(endcode) // [ true, 'bcuH42HRi0ZzUj7n5cQy9g==' ]
// const decode = Crypto.decrypt.v1(endcode[1], key)
// console.log(decode) // [ true, '8811aa,,' ]

// 加密
const endcode2 = encodeAccountV1({username, password})
console.log(endcode2) // [true,{username: 'LFkb4u6uwxRJE3e0+ic8tg==',password: '+aYVOV0aTvgGgo+X/gTv4Q=='}]
// 解密
const decode2 = decodeAccountV1({request:{body:{username: endcode2[1].username, password: endcode2[1].password},query:{}}})
console.log(decode2) // [ true, { username: 'user135', password: '8811aa,,' } ]
```

