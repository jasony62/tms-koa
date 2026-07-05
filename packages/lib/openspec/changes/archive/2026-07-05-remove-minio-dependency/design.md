## Context

`minio` npm package is currently in `dependencies` (`"minio": "8.0.5"`) and has a static `import * as Minio from 'minio'` at the top of `src/context/fs.ts`. This means:

- Every tms-koa user installs `minio` regardless of whether they use it
- Even users who configure `local` file service (not minio) load the `minio` module at runtime because `context/fs.ts` has a static top-level import
- The `MinioFS` class (`src/model/fs/minio.ts`) and all other references in the codebase use the `Minio.Client` instance (stored on `fsContext.minioClient`), not the `minio` package directly

The existing `redis` peerDep already establishes the precedent for conditionally-required dependencies.

## Goals / Non-Goals

**Goals:**
- Move `minio` from always-installed `dependencies` to optionally-installed `peerDependencies`
- Convert the sole static import to a dynamic `await import()` so the `minio` package is only loaded when MinIO backend is configured
- Zero behavior change for MinIO users (must install `minio` themselves, same as `redis`)
- Smaller install footprint for users who don't use MinIO

**Non-Goals:**
- Removing or refactoring the `MinioFS` class or its interface
- Changing the file service configuration format
- Adding S3-compatible backends beyond MinIO

## Decisions

1. **Dynamic import over conditional `require()`** — `context/fs.ts` is already an ESM module (`"type": "module"`). `await import('minio')` is the standard ESM approach and matches the existing dynamic import pattern used elsewhere (e.g., agenda, neo4j before removal).

2. **`peerDependencies` over `optionalDependencies`** — Matches the existing `redis` pattern. `peerDependencies` require the consumer to explicitly install `minio` if they need it, making dependency management more transparent than silent fallback.

3. **No change to `MinioFS` class or other files** — Only `context/fs.ts` has the static import. The `MinioFS` constructor receives the `Minio.Client` instance from `fsContext.minioClient` — it never imports the `minio` package itself. `controller/fs/base.ts` imports `MinioFS` for `new MinioFS(...)` but that's a local class reference, not a minio package reference.

## Risks / Trade-offs

- [**Breaking change**] → Tag v0.3.0. Users who use MinIO will need to `npm install minio` after upgrading. Mitigation: document clearly in release notes.
- [**Version skew**] → Without a version constraint in `dependencies`, the user may install an incompatible version. Mitigation: `peerDependencies` supports version ranges (`"minio": "^8.0.0"`).
- [**Dynamic import error**] → If `minio` is not installed and user configures `fs.minio.enabled: true`, the `await import('minio')` will throw MODULE_NOT_FOUND. Mitigation: wrap in try/catch and log a clear error message telling the user to install `minio`.
