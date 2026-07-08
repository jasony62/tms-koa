# tms-koa (lib)

`tms-koa` 是基于 `Koa` 的轻量级 API 服务框架核心包，负责应用启动、配置加载、认证路由、控制器调度、文件服务、Swagger / Prometheus 监控、MongoDB/Redis/Agenda 等服务初始化。

## 主要特性

- `TmsKoa`：基于 `Koa` 的框架入口，封装应用初始化与启动流程
- `Context`：全局服务上下文，包含 App / Mongo / Redis / Fs / Push / Swagger / Metrics / Agenda 等服务实例
- 配置文件加载：支持 `config/{name}.js` 和 `config/{name}.local.js` 两级覆盖
- API 认证：支持 `jwt`、`redis`、本地 token，以及可定制的验证码服务
- 控制器插件：支持从目录或环境变量加载外部控制器插件定义
- 文件管理：支持上传文件、静态文件托管和文件下载
- Swagger 与指标：可选启用 OpenAPI 文档和 Prometheus 指标路由
- 运行时预置：跨域、静态资源、`koa-body`、异常监听、HTTPS 支持

## 安装

在 monorepo 中已存在 `packages/lib` 包，若单独使用请按需安装依赖：

```bash
pnpm install
```

注意：`redis`、`minio` 等部分依赖为 `peerDependencies`，需要根据实际使用场景额外安装。

## 使用示例

```ts
import { TmsKoa } from 'tms-koa'

async function main() {
  const app = new TmsKoa()
  await app.startup({
    beforeController: [],
    afterController: [],
    afterInit: (context) => {
      console.log('应用初始化完成', Object.keys(context))
    },
  })
}

main().catch(console.error)
```

## 运行与构建

```bash
pnpm build
pnpm test
```

## 配置说明

框架默认从当前工作目录下的 `config` 目录加载配置文件。例如：

- `config/app.js`
- `config/redis.js`
- `config/mongodb.js`
- `config/fs.js`
- `config/push.js`
- `config/agenda.js`
- `config/swagger.js`
- `config/metrics.js`

> 配置文件应导出默认对象（`export default {}`），并使用 `.js` 扩展名。

### `app.js`

基础应用配置示例：

```js
export default {
  port: 3000,
  name: 'tms-koa-app',
  router: {
    auth: { prefix: '' },
    controllers: { prefix: '/api' },
    swagger: { prefix: '/oas' },
    metrics: { prefix: '/metrics' },
  },
  auth: {
    captcha: { code: 'a1z9' },
    client: { accounts: [{ id: 1, username: 'user1', password: '123456' }] },
    jwt: {
      privateKey: 'tms-koa-secret',
      expiresIn: 7200,
    },
  },
  body: {
    jsonLimit: '1mb',
    formLimit: '56kb',
    textLimit: '56kb',
  },
}
```

### 环境变量覆盖

- `TMS_KOA_CONFIG_DIR`：配置目录，默认 `process.cwd()/config`
- `TMS_KOA_APP_HTTP_PORT`：应用 HTTP 端口
- `TMS_KOA_CONTROLLERS_PREFIX`：控制器路由前缀
- `TMS_KOA_CONTROLLERS_PLUGINS_NPM`：JSON 数组形式的控制器插件定义
- `TMS_KOA_CONTROLLERS_PLUGINS_NPM_DIR`：控制器插件配置文件目录
- `TMS_KOA_CLIENT_ACCOUNT_DIR`：内置账号 JSON 数据目录
- `TMS_KOA_APP_AUTH_TOKEN_LOCAL`：本地免认证 token，例如 `token1:1,token2:2`

## 常见配置项

### MongoDB

```js
export default {
  disabled: false,
  master: {
    host: '127.0.0.1',
    port: 27017,
    replicaSet: '',
    maxPoolSize: 10,
    authSource: 'admin',
    connectionString: 'mongodb://127.0.0.1:27017/mydb',
  },
}
```

### Redis

```js
export default {
  disabled: false,
  master: {
    host: '127.0.0.1',
    port: 6379,
    password: '******',
  },
}
```

### 文件服务

```js
export default {
  local: {
    rootDir: 'files',
  },
}
```

## 代码导出

`packages/lib/src/index.ts` 对外导出：

- `TmsKoa`
- `Context`
- `loadConfig`
- `Ctrl`
- `Client`
- `Captcha`
- `ResultData`
- `ResultFault`
- `ResultObjectNotFound`
- `ResultSSE`
- `DbModel`

## 说明

- `TmsKoa.startup()` 会自动启动 HTTP 服务，并可选启动 HTTPS
- `loadConfig()` 会合并 `config/{name}.js` 与 `config/{name}.local.js`
- 如果 `auth` 配置未开启或 `disabled: true`，则不会加载认证路由
- 控制器插件可通过目录或环境变量注册，适合微服务插件化扩展

## 参考

- 根目录 `README.md`
- `docs/` 中的控制器、访问控制、文件服务、监控等说明
- `packages/lib/src/app.ts` 为核心启动逻辑
