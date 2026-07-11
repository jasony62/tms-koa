## 1. mongodb.ts — 模块自身防御

- [x] 1.1 `init()` 顶部加 `if (config?.disabled === true) return []`
- [x] 1.2 `mongoClient()` 无实例时改为 `warn + return null`（替代 throw）
- [x] 1.3 `mongoClientSync()` 无实例时改为 `warn + return null`（替代 undefined）

## 2. agenda.ts — 调用侧防御

- [x] 2.1 `mongoClient()` 返回 null 时改为 `warn + return {}`（替代 throw）
- [x] 2.2 修复第 37 行 `config.diabled` 拼写错误为 `config.disabled`

## 3. fs.ts — 验证已有防御

- [x] 3.1 `initMongoDb` 中 `mongoClient()` 返回 null 后已有 `return false`，验证逻辑正确
