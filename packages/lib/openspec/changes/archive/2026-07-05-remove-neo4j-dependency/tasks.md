## 1. Remove Neo4j from package manifest

- [x] 1.1 Remove `"neo4j-driver": "^4.4.2"` from `peerDependencies` in `packages/lib/package.json`

## 2. Delete Neo4j context module

- [x] 2.1 Delete `packages/lib/src/context/neo4j.ts`

## 3. Remove Neo4j wiring from app.ts

- [x] 3.1 Remove `Neo4jContext` variable declaration from the top-level vars block (line 28)
- [x] 3.2 Remove `if (Neo4jContext) await Neo4jContext.close()` from `SIGINT` handler (line 47)
- [x] 3.3 Remove `if (Neo4jContext) await Neo4jContext.close()` from `SIGTERM` handler (line 52)
- [x] 3.4 Remove the Neo4j init block (lines 389–405): `loadConfig('neo4j')`, dynamic import, init call, and debug log

## 4. Delete Neo4j test

- [x] 4.1 Delete `packages/lib/tests/lib/context/neo4j.spec.js`

## 5. Verify

- [x] 5.1 Run `pnpm build` to confirm TypeScript compiles without errors
- [x] 5.2 Run `pnpm test` to confirm existing tests still pass
