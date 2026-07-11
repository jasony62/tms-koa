## Why

MongoDB 当前在 `app.ts` 层已有 `disabled` 前置检查，但 `mongodb.ts` 自身和依赖方（agenda、fs）在模块层面没有防御。当禁用 MongoDB 时，`mongoClient()` 抛出异常会导致 agenda 和 fs 初始化失败。需要建立完整的防御链路：模块自身识别禁用 → 公共方法返回空 → 调用方优雅处理。

## What Changes

1. **`src/context/mongodb.ts:init`** — 新增 `disabled` 前置检查，静默跳过
2. **`src/context/mongodb.ts:mongoClient/mongoClientSync`** — 无实例时改为 warn + return null（替代 throw）
3. **`src/context/agenda.ts`** — 调用 `mongoClient()` 后检查 null，跳过 agenda 初始化
4. **`src/context/fs.ts:initMongoDb`** — 调用 `mongoClient()` 后检查 null，跳过 domain 的 DB 设置

## Capabilities

### New Capabilities
- `mongodb-disabled`: 通过 `{ mongodb: { disabled: true } }` 配置全局禁用 MongoDB，禁用后 agenda 和 fs 的文件信息存储功能静默跳过

### Modified Capabilities
无

## Impact

- `src/context/mongodb.ts` — 3 处改动：init 前置检查 + mongoClient 改返回 + mongoClientSync 改返回
- `src/context/agenda.ts` — 1 处改动：mongoClient 返回 null 时跳过
- `src/context/fs.ts` — 1 处改动：mongoClient 返回 null 时跳过
- 无依赖变更，无 API 变更
