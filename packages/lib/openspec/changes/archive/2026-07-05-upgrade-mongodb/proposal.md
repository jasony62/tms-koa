## Why

The `mongodb` driver is currently pinned at `5.9.2` while the latest is `7.x`. Staying on v5 means missing security patches, bug fixes, and performance improvements. Users installing `tms-koa` receive an outdated driver that triggers deprecation warnings with modern MongoDB deployments.

## What Changes

- Upgrade `mongodb` from `^5.9.2` to `^7` in `packages/lib/package.json` (dependencies)
- Upgrade `mongodb` from `5.9.2` to `^7` in `packages/account/package.json` (dependencies)
- Upgrade `mongodb` from `5.9.2` to `^7` in `packages/bucket/package.json` (dependencies)
- Replace `MongoError` with `Error` in `packages/lib/src/context/mongodb.ts` (**BREAKING**: `MongoError` was removed in `mongodb@6`)
- Verify no other API breakage across all consumers

## Capabilities

### New Capabilities

None — this is a dependency upgrade, not a new feature.

### Modified Capabilities

None — no spec-level behavior changes. The public API (config format, connection semantics, error responses) remains identical.

## Impact

- **`packages/lib/src/context/mongodb.ts`**: `import { MongoClient, MongoError }` → `import { MongoClient }`; all 8 `throw new MongoError(msg)` → `throw new Error(msg)`
- **`packages/lib/package.json`**: `mongodb: "5.9.2"` → `mongodb: "^7.0.0"`
- **`packages/account/package.json`**: same version bump (uses `ObjectId`)
- **`packages/bucket/package.json`**: same version bump (uses `mongodb` namespace and `ObjectId`)
- No other source changes needed — `MongoClient`, `ObjectId`, `db().collection()`, `find()`, `updateOne()`, `findOne()`, `countDocuments()`, `insertOne()`, `deleteOne()` are all stable across v5→v7
