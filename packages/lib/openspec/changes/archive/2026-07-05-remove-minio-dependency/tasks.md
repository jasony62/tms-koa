## 1. Convert static import to dynamic import

- [x] 1.1 Replace `import * as Minio from 'minio'` with dynamic `await import('minio')` inside `initMinio()` in `src/context/fs.ts`
- [x] 1.2 Wrap dynamic import in try/catch with clear error message telling user to install `minio` package

## 2. Update package manifest

- [x] 2.1 Move `"minio": "8.0.5"` from `dependencies` to `peerDependencies` in `packages/lib/package.json` (as `"minio": "^8.0.0"`)

## 3. Verify

- [x] 3.1 Run `pnpm install` to resolve updated dependency declarations
- [x] 3.2 Run `pnpm build` to verify compilation passes
