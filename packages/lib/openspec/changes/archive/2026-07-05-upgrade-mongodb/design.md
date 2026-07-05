## Context

`mongodb` driver is at `5.9.2` (latest v5). The npm registry shows `7.x` is available. There are 4 files across the monorepo that import from `mongodb`:

- `packages/lib/src/context/mongodb.ts` — `MongoClient`, `MongoError`
- `packages/account/src/models/store/mongodb.ts` — `ObjectId`
- `packages/bucket/src/controllers/admin/bucket.ts` — `ObjectId`
- `packages/bucket/src/controllers/admin/coworker.ts` — `mongodb` (namespace)

The only breaking change between v5 and v7 is the removal of `MongoError` (replaced by `MongoServerError`, `MongoRuntimeError`, etc.).

## Goals / Non-Goals

**Goals:**
- Upgrade all 3 package.json files to `mongodb@^7`
- Replace the 8 `MongoError` usages in `context/mongodb.ts` with `Error`
- Verify build passes and existing tests are unaffected

**Non-Goals:**
- Not refactoring the connection management API (backward-compatible)
- Not changing the config schema or connection URL format
- Not upgrading `@types/mongodb` or related type packages (the `mongodb` package ships its own types since v5)

## Decisions

1. **Target `^7` not `^6`.** Going straight to v7 avoids a second upgrade cycle. The v5→v6 delta is the same as v5→v7 for the APIs we use.

2. **Replace `MongoError` with `Error`.** `MongoError` was used as a plain error wrapper (`throw new MongoError(msg)`) — never caught by type-specific handlers. `Error` is a drop-in replacement with no behavioral change.

3. **`mongodb@7` connection behavior.** v6+ uses lazy connection by default — `new MongoClient(url)` no longer requires explicit `.connect()`. However, the existing code explicitly calls `await client.connect()` which is still supported (though no-op in most cases). Keeping it is harmless.

## Risks / Trade-offs

- **[Lazy connection change in v6+]** → The explicit `client.connect()` still works and provides backward-compatible timing guarantees for users who rely on the connection being fully established after init.
- **[Plugin packages need independent upgrades]** → `account` and `bucket` packages have their own `mongodb` dependency. They must be bumped in lockstep since `pnpm` resolves a single version.
- **[No integration test coverage]** → The only existing test (`model.spec.js`) doesn't exercise MongoDB. Manual verification via `pnpm build` is the validation path.
