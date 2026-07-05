## Why

`minio` is in `dependencies` but its npm package is only needed at runtime when the user configures `fs.minio.enabled: true`. Even for local-only file service users, the static `import * as Minio from 'minio'` in `context/fs.ts` forces the package to be loaded. Moving to `peerDependencies` + dynamic import eliminates this unnecessary always-installed dependency.

## What Changes

1. **`src/context/fs.ts`**: Replace static `import * as Minio from 'minio'` with `await import('minio')` inside the `initMinio()` function
2. **`package.json`**: Move `"minio": "8.0.5"` from `dependencies` to `peerDependencies` (alongside existing `redis` peerDep)

## Capabilities

No new capabilities or spec-level changes — this is a dependency management change only.

## Impact

- `src/context/fs.ts` — single import line converted from static to dynamic
- `package.json` — dependency classification changed
- All other files (`MinioFS` class, `base.ts`, `upload.ts`) remain unchanged — they reference the `minioClient` instance, not the `minio` package directly
- Users who use MinIO must install `minio` themselves (same pattern as `redis`)
- Users who only use local file service or don't use file service at all will no longer need `minio` installed
