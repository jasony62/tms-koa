通过创建 bucket，实现数据逻辑隔离。

# api

## 新建 bucket

```shell
curl 'http://localhost:3009/api/bucket/admin/bucket/create' -H 'content-type: application/json' -H 'authorization: Bearer accesstoken01' -d '{"name": "test01", "title": "测试01"}'
```

```json
{
  "msg": "正常",
  "code": 0,
  "result": {
    "name": "test01",
    "title": "测试01",
    "creator": "app01",
    "createAt": "2025-04-04T09:09:40.299Z",
    "_id": "67efa1d44b21209ee232dbd8"
  }
}
```

注意：`createAt`是 ISO 格式，差 8 小时。

## 查看用户的 bucket

```shell
curl 'http://localhost:3009/api/bucket/admin/bucket/list' -H 'content-type: application/json'  -H 'authorization: Bearer accesstoken01' -d '{"name": "test01", "title": "测试01"}'
```

```json
{
  "msg": "正常",
  "code": 0,
  "result": [
    {
      "_id": "67ecf83aa9aae9785a138db9",
      "name": "test01",
      "title": "测试01",
      "creator": "app01",
      "createAt": "2025-04-04T09:09:20.199Z"
    },
    {
      "_id": "67efa1d44b21209ee232dbd8",
      "name": "test02",
      "title": "测试02",
      "creator": "app01",
      "createAt": "2025-04-04T09:09:40.299Z"
    }
  ]
}
```

## 更新 bucket

```shell
curl 'http://localhost:3009/api/bucket/admin/bucket/update?bucket=test01' -H 'content-type: application/json' -H 'authorization: Bearer  accesstoken01' -d '{"title": "测试01_1"}'
```

```json
{ "msg": "正常", "code": 0, "result": { "title": "测试05_1" } }
```

注意：无法修改`name`和`creator`字段。

## 删除 bucket

```shell
curl 'http://localhost:3009/api/bucket/admin/bucket/remove?bucket=test01' -H 'authorization: Bearer accesstoken01'
```

```json
{ "msg": "正常", "code": 0, "result": "ok" }
```

## 邀请加入 bucket

```shell
curl 'http://localhost:3009/api/bucket/admin/coworker/invite?bucket=test01' -H "authorization: Bearer accesstoken01" -H 'content-type: application/json' -d '{"nickname": "alice"}'
```

注意：只允许空间的创建人发起邀请。

```json
{ "msg": "正常", "code": 0, "result": "xxxx" }
```

## 查看所有邀请

```shell
curl 'http://localhost:3009/api/bucket/admin/coworker/list?bucket=test01' -H 'authorization: Bearer accesstoken01'
```

```json
{
  "msg": "正常",
  "code": 0,
  "result": [
    {
      "_id": "67ef95c71c3b85fb3140b2da",
      "inviter": "app01",
      "bucket": "test01",
      "code": "l5AF",
      "createAt": "2025-04-04T08:18:15.431Z",
      "coworker": {
        "nickname": "alice",
        "id": "alice"
      },
      "acceptAt": "2025-04-04T08:18:34.737Z"
    }
  ]
}
```

## 接受邀请

```shell
curl 'http://localhost:3009/api/bucket/admin/coworker/accept?bucket=test01' -H 'content-type: application/json' -H "authorization: Bearer $access_token" -d '{"code": "98Ef", "nickname": "alice"}'
```

```json
{ "msg": "正常", "code": 0, "result": "ok" }
```

## 查看空间（含被邀请的）

```shell
curl 'http://localhost:3009/api/bucket/admin/bucket/list' -H "authorization: Bearer $access_token"
```

```json
{
  "msg": "正常",
  "code": 0,
  "result": [
    {
      "name": "test01",
      "title": "测试01",
      "creator": "app01",
      "createAt": "2025-04-04T09:09:30.199Z"
    },
    {
      "name": "test05",
      "title": "测试05",
      "creator": "app01",
      "createAt": "2025-04-04T09:09:40.299Z"
    }
  ]
}
```

注意：没有提供`bucket`的`_id`。

## 取消邀请

```shell
curl 'http://localhost:3009/api/bucket/admin/coworker/remove?bucket=test01&nickname=alice' -H 'authorization: Bearer accesstoken01'
```

```json
{ "msg": "正常", "code": 0, "result": "ok" }
```

# 自定义属性

配置文件`bucket.js`

```js
export default {
  disabled: true,
  schemas: {},
  schemasRootName: '',
}
```
