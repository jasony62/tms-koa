## Context

Neo4j support in `tms-koa` is provided by two files in `packages/lib`:

- `src/context/neo4j.ts` — Neo4j driver connection manager (singleton, supports multiple named connections)
- `src/app.ts` — wiring: global variable `Neo4jContext`, dynamic import on startup, close on SIGINT/SIGTERM

The `neo4j-driver` npm package is declared as a `peerDependency` in `package.json`. No plugin packages, no auth path, no controller dispatch, and no other part of the framework imports or depends on it. The test file `tests/lib/context/neo4j.spec.js` requires a running Neo4j instance.

## Goals / Non-Goals

**Goals:**
- Remove `neo4j-driver` from `peerDependencies`
- Delete the context module and its wiring in `app.ts`
- Delete the Neo4j test
- Ensure zero impact on existing functionality

**Non-Goals:**
- Not extracting Neo4j into a plugin package (out of scope — no demand signal)
- Not modifying the `Context` global singleton pattern itself

## Decisions

1. **Delete, don't extract.** Making Neo4j a plugin would require defining a `Neo4jContext` interface, creating an npm package, and maintaining a migration path. No consumer has requested this, and the existing code is only 137 lines. Delete is the simplest correct action.

2. **Remove SIGINT/SIGTERM close hooks for Neo4j.** The current `app.ts` calls `Neo4jContext.close()` on graceful shutdown (lines 47, 52). After removal, these lines are simply deleted — no replacement needed.

3. **Keep the `Neo4jContext` slot on `Context` undefined.** The global `Context` object is typed as `any`. After deletion, `Context.Neo4jContext` will be `undefined` instead of a context instance. No code checks for its existence besides the now-removed init block, so this is safe.

## Risks / Trade-offs

- **[Backward compatibility for direct importers]** → No known consumers. The `Context.Neo4jContext` was never documented as a public API in README or specs. Risk is negligible.
- **[Someone building on Neo4j later]** → They can install `neo4j-driver` and write their own connection manager, or a plugin package could be created later. The 137 lines of deleted code are a reasonable reference.
