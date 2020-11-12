# http

在`config/app.js`中指定`port`字段，作为`http`服务端口（可以不指定，默认值`3000`）。

# https

在`config/app.js`中指定`https`字段，设置`https`服务。

| 参数     | 说明                   |
| -------- | ---------------------- |
| disabled | 设置为`true`，表示关闭 |
| port     | 服务端口               |
| key      | 密钥文件路径           |
| cert     | 证书文件路径           |

# 静态文件

项目根目录下创建`public`目录，放置需要访问的静态文件。

# 跨域访问

在`config/app.js`中指定`cors`字段。

| 参数        | 必填 | 说明                               | 默认值 |
| ----------- | ---- | ---------------------------------- | ------ |
| credentials | 否   | `Access-Control-Allow-Credentials` | false  |
