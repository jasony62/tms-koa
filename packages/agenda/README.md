# 测试

获取`access_token`

```shell
curl -X POST -H "Content-type: application/json" "http://localhost:3009/auth/authenticate" -d '{"username":"admin","password":"admin"}'
```

定义任务

```shell
curl 'http://localhost:3009/api/agenda/define?access_token=<access_token>' -H 'Content-Type: application/json' -X POST -d '{"name":"job001"}'
```

立刻执行一次任务

```shell
curl 'http://localhost:3009/api/agenda/now?access_token=<access_token>' -H 'Content-Type: application/json' -X POST -d '{"name":"job001","data":{"url":"http://localhost:3009/api/tryGet?access_token=<access_token>&value=hello","method":"GET"}}'
```
