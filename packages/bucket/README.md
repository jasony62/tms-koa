通过创建 bucket，实现数据逻辑隔离。

# api

## 新建 bucket

```shell
curl 'http://localhost:3009/api/bucket/admin/bucket/create' -H 'content-type: application/json' -H 'authorization: Bearer xxx' -d '{"name": "test01", "title": "测试01"}'
```

```json
{
  "msg": "正常",
  "code": 0,
  "result": {
    "name": "test01",
    "title": "测试01",
    "creator": "app01",
    "_id": "67ecf2a5f5abd9ec867b9187"
  }
}
```

## 查看用户的 bucket

```shell
curl 'http://localhost:3009/api/bucket/admin/bucket/list' -H 'content-type: application/json'  -H 'authorization: Bearer xxx' -d '{"name": "test01", "title": "测试01"}'
```

```json
{
  "msg": "正常",
  "code": 0,
  "result": [
    {
      "_id": "67ecf2a5f5abd9ec867b9187",
      "name": "test01",
      "title": "测试01",
      "creator": "app01"
    }
  ]
}
```

## 更新 bucket

```shell
curl 'http://localhost:3009/api/bucket/admin/bucket/update?bucket=test01' -H 'content-type: application/json' -H 'authorization: Bearer  accesstoken01' -d '{"title": "测试01_1"}'
```

## 删除 bucket

```shell
 curl 'http://localhost:3009/api/bucket/admin/bucket/remove?bucket=test01' -H 'authorization: Bearer xxx'
```

```json
{ "msg": "正常", "code": 0 }
```

## 要求加入 bucket

```shell
curl 'http://localhost:3009/api/bucket/admin/coworker/invite?bucket=test01' -H "authorization: Bearer accesstoken01" -H 'content-type: application/json' -d '{"nickname": "alice"}'
```

```json
{ "msg": "正常", "code": 0, "result": "wn0S" }
```

## 查看所有邀请

```shell
curl 'http://localhost:3009/api/bucket/admin/coworker/list?bucket=test01' -H 'authorization: Bearer xxx'
```

```json
{
  "msg": "正常",
  "code": 0,
  "result": [
    {
      "_id": "67ecf903c528fe85a71b7b0f",
      "inviter": "app01",
      "bucket": "test01",
      "code": "wn0S",
      "createAt": "2025-04-02T16:44:51.256Z",
      "expireAt": "2025-04-02T17:22:47.141Z",
      "nickname": "alice"
    }
  ]
}
```

## 接受邀请

```shell
curl 'http://localhost:3009/api/bucket/admin/coworker/accept?bucket=test01' -H 'authorization: Bearer yyy' -d '{"code": "", "nickname": "alice"}'
```

```json
{
    _id: ObjectId('67ecfec79bf099cd12858778'),
    inviter: 'app01',
    bucket: 'test01',
    code: 'sIg1',
    createAt: ISODate('2025-04-02T17:09:27.516Z'),
    expireAt: ISODate('2025-04-02T17:39:27.516Z'),
    nickname: 'Alice Liddel',
    acceptAt: '2025-04-03 01:09:55',
    invitee: 'Alice Liddel'
  }
```

```json
[
  {
    _id: ObjectId('67ecf83aa9aae9785a138db9'),
    name: 'test01',
    title: '测试01',
    creator: 'app01',
    coworkers: [
      {
        id: 'Alice Liddel',
        nickname: 'Alice Liddel',
        accept_time: '2025-04-03 01:09:55'
      }
    ]
  }
]
```

## 取消邀请

```shell
curl 'http://localhost:3009/api/bucket/admin/coworker/remove?bucket=test01&coworker=Alice%20Liddel' -H 'authorization: Bearer xxx'
```
