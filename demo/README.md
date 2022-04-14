# 安装

> yarn

进入`node_modules/tms-koa`

# 启动

> yarn start

或

> npm run pm2

# 打开静态页

> curl http://localhost:3001/index.html

# 调用 API

> curl http://localhost:3001/api/tryGet?value=hello

# 上传 base64 图片

> curl -X POST -H "Content-Type: text/plain" -d @image.jpeg.base64 "http://localhost:3001/api/fs/image/uploadBase64?thumb=Y"
