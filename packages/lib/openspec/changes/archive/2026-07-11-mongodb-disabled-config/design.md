## Context

当前 MongoDB 禁用只在 `app.ts` 层有守卫：

```
app.ts:353  if (mongoConfig.disabled !== true) → init()
  └─ MongoContext 赋值为 undefined
```

但 `mongodb.ts` 模块自身不识别 `disabled`，其 `mongoClient()` 方法在无实例时 `throw`。下游调用方（agenda、fs）直接调用 `MongoContext.mongoClient()` 时崩溃。

## Goals / Non-Goals

**Goals:**
- `mongodb.ts:init` 自身识别 `disabled: true`，静默跳过
- `mongodb.ts:mongoClient/mongoClientSync` 无实例时 warn + return null
- agenda 在 MongoDB 禁用时跳过 agenda 初始化
- fs 在 MongoDB 禁用时跳过文件信息数据库设置

**Non-Goals:**
- 不涉及多数据源级别禁用（只做全局 `disabled`）
- 不改变现有 `app.ts` 的外层守卫逻辑

## Decisions

1. **`mongodb.ts:init` 前置检查 `disabled`** — 防御深度的保障。即使 `app.ts` 的守卫被绕过或被其他模块直接调用，也不会崩溃。

2. **`mongoClient` 返回 null 而非空对象** — 调用方可以用 `if (!mongoClient)` 判断，保持与现有代码风格一致（fs.ts 已有 `if (!mongoClient)` 检查模式）。

3. **只改 agenda 和 fs 两个调用方** — `app.ts` 里的 `MongoContext` 变量已为 undefined，其他调用方（如 `router.ts:490`）已经有 `if (MongoContext)` 守卫。

## Risks / Trade-offs

- 无风险。所有改动都是防御性增强，不改变运行时行为。
