## 1. Upgrade package manifests

- [x] 1.1 Update `mongodb` from `"5.9.2"` to `"^7.0.0"` in `packages/lib/package.json` (dependencies)
- [x] 1.2 Update `mongodb` from `"5.9.2"` to `"^7.0.0"` in `packages/account/package.json` (dependencies)
- [x] 1.3 Update `mongodb` from `"5.9.2"` to `"^7.0.0"` in `packages/bucket/package.json` (dependencies)

## 2. Fix breaking change

- [x] 2.1 Replace `import { MongoClient, MongoError }` with `import { MongoClient }` in `packages/lib/src/context/mongodb.ts`
- [x] 2.2 Replace all 8 `throw new MongoError(msg)` with `throw new Error(msg)` in `packages/lib/src/context/mongodb.ts`

## 3. Verify

- [x] 3.1 Run `pnpm install` to resolve new dependency versions (5.9.2 → 7.4.0)
- [x] 3.2 Run `pnpm build` in `lib`, `account`, and `bucket` packages
