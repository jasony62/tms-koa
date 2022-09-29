提供`tms-koa`框架的验证码功能。

# tms-koa 验证码方法

在`tms-koa`框架配置文件`./config/app.js`中配置

```
module.exports = {
  auth: {
    captcha: {  // 验证码
      npm: {
        disabled: false,
        id: 'tms-koa-captcha',
        module:'dist',
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

在账号服务模块配置文件`.config/account.js/captchaConfig`中设置

| 字段          | 说明                                                               | 类型    | 默认                       | 必填 |
| ------------- | ------------------------------------------------------------------ | ------- | -------------------------- | ---- |
| disabled      | 是否启用验证码                                                     | boolean | false                      | 否   |
| storageType   | 验证码存储方式 支持 redis、lowdb                                   | string  | lowdb                      | 否   |
| masterCaptcha | 万能验证码                                                         | string  |                            | 否   |
| codeSize      | 验证码长度                                                         | int     | 4                          | 否   |
| alphabetType  | 验证码字母表类型 与 alphabetType 不可公用，优先级大于 alphabetType | string  | number,upperCase,lowerCase | 否   |
| expire        | 验证码有效期（s）                                                  | int     | 300                        | 否   |

# API 调用示例

## 获取验证码

```
curl 'http://localhost:3001/auth/captcha?appid=demo&captchaid=demo01'
```

```
curl 'http://localhost:3001/auth/captcha?appid=demo&captchaid=demo01&returnType=text'
```

附加参数

| 参数         | 说明                                              | 默认值                      |
| ------------ | ------------------------------------------------- | --------------------------- |
| storageType  | 验证码存储方式`lowdb / redis`                     | lowdb                       |
| codeSize     | 验证码长度                                        | 4                           |
| alphabetType | 字母表类型 默认 数字+大写字母+小写字母            | "number,upperCase,lowerCase |
| alphabet     | 与 alphabetType 不可公用，优先级大于 alphabetType | "1234567890"                |
| expire       | 过期时间，单位秒                                  | 300                         |
| returnType   | 返回验证码类型`text / image`                      | image                       |

## 检验验证码

```
curl 'http://localhost:3001/auth/checkCaptcha?appid=demo&captchaid=demo01&code='
```

附加参数

| 参数       | 说明              | 默认值 |
| ---------- | ----------------- | ------ |
| strictMode | 检验大小写`N / Y` | N      |
