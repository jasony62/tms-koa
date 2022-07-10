# 安装

> pnpm i

`tms-koa`是采用本地路径的方式进行安装。

为了解决`demo`和`tms-kos`使用一个`log4js`实例的问题，需要全局安装`log4js`。

# 启动

> pnpm start

> TMS_KOA_CONFIG_DIR=./demo/config TMS_KOA_CONTROLLERS_DIR=./demo/controllers node ./demo/server

# 打开静态页

> curl http://localhost:3001/index.html

# 调用 API

> curl 'http://localhost:3001/api/tryGet?value=hello'

# 上传 base64 图片

> curl -X POST -H "Content-Type: text/plain" -d @image.jpeg.base64 "http://localhost:3001/fs/image/uploadBase64?thumb=Y"
