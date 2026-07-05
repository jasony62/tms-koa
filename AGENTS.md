# tms-koa — AGENTS.md

## Monorepo layout

pnpm workspace (`packages/*`). All packages are ESM + TypeScript, compiled with `tsc` → `dist/`.

| package | npm name | purpose |
|---------|----------|---------|
| `lib` | `tms-koa` | core framework |
| `demo` | `tms-koa-demo` | example app |
| `account`, `agenda`, `bucket`, `captcha`, `crypto` | `tms-koa-*` | controller plugins |

`pnpm-lock.yaml` is gitignored — no lockfile is committed.

## Commands (run from the package dir)

- `pnpm build` — `rimraf ./dist && tsc`
- `pnpm test` — jest (only `lib` has tests; jest uses `@/` path alias via `jest.config.js`)
- `pnpm start` — runs `dist/server.js` (demo only)

## Key architecture

- **Entrypoint**: `TmsKoa` (extends `Koa`) in `packages/lib/src/app.ts`. Constructor reads env + `config/*.js` files.
- **Config loading**: `<configDir>/{name}.js` merged with `<configDir>/{name}.local.js` override. Config dir defaults to `process.cwd() + '/config'`, overridable via `TMS_KOA_CONFIG_DIR` env. Configs use `module.exports` (CJS) and are loaded via dynamic `import()` — they must be `.js`.
- **Controller dispatch**: URL `/{prefix}/{controller}/{method}` → `dist/controllers/{name}.js` (or `{name}/main.js` for dir matches). Controllers extend `Ctrl` and must `export default`.
- **Auth chain**: access-white → trusted-hosts → jwt/redis/keycloak/token check.
- **Plugin controllers**: NPM packages advertise with `tms-koa_ctrl-plugin.json` (`{ id, dir, alias }`). Resolved via `ctrl_plugin_config/` dir or `TMS_KOA_CONTROLLERS_PLUGINS_NPM_DIR` env.
- **`Context`** global singleton holds initialized service contexts (Mongo, Redis, Neo4j, Fs, Push, Agenda, Swagger, Metrics).

## Non-obvious facts

- **`noImplicitAny: false`** in every `tsconfig.json` — TypeScript won't flag untyped variables.
- **peerDependencies won't auto-install**: `neo4j-driver`, `redis` (and transitive `mysql`/`better-sqlite3` via tms-db) must be installed manually.
- **Auth is optional**: Omit `auth` in config or set `disabled: true` to skip all auth. JWT > Redis when both configured.
- **Local tokens**: `TMS_KOA_APP_AUTH_TOKEN_LOCAL` env supports `token:userId` pairs (internal API calls).
- **No CI/CD**, no linter, no formatter in the repo.
- **OpenSpec workflow skills** live in `packages/lib/.opencode/skills/` — used for proposal-based changes.
- **Chinese docs** in `docs/` cover controllers, auth, fs, mongodb, neo4j, etc.

## Testing quirks

- Only `packages/lib/tests/` has tests — 3 CommonJS `.js` files (not TypeScript), using `require()`:
  - `tests/lib/model/model.spec.js` — unit test (no DB needed)
  - `tests/lib/model/model.error.spec.js` — requires a running MySQL, reads config from `@/config/db`
  - `tests/lib/context/neo4j.spec.js` — requires a running Neo4j on `localhost:7687`
