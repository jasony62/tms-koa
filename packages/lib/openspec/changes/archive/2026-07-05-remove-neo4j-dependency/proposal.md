## Why

`neo4j-driver` is a peerDependency of `tms-koa` but is only used in one optional context module (`context/neo4j.ts`). No core framework feature (auth, routing, controller dispatch, model) depends on it, and no plugin package references Neo4jContext. Users who want Neo4j can install `neo4j-driver` themselves — the framework should not impose installation friction or CI setup cost for a feature the majority of users don't need.

## What Changes

- Remove `neo4j-driver` from `peerDependencies` in `packages/lib/package.json`
- Delete `packages/lib/src/context/neo4j.ts` — the Neo4j connection manager
- Remove the Neo4j init/close wiring from `packages/lib/src/app.ts`
- Remove the test file `packages/lib/tests/lib/context/neo4j.spec.js`
- The `Context.Neo4jContext` export on the global singleton will no longer exist — consumers (none found) would get `undefined`

## Capabilities

### New Capabilities

None. This is a removal, not a new feature.

### Modified Capabilities

None. No spec-level behavior changes — Neo4j was never a guaranteed capability of the framework; it was an optional add-on loaded only when the user provided a `neo4j` config file.

## Impact

- **`packages/lib/package.json`**: Remove `neo4j-driver` from `peerDependencies`
- **`packages/lib/src/context/neo4j.ts`**: Delete the file (137 lines)
- **`packages/lib/src/app.ts`**: Remove the `Neo4jContext` variable declaration, the SIGINT/SIGTERM close hooks, and the init block (lines 28, 47, 52, 389–405)
- **`packages/lib/tests/lib/context/neo4j.spec.js`**: Delete the test file
- **No downstream impact**: No plugin packages reference Neo4jContext. No existing spec files reference Neo4j.
