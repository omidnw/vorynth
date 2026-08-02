---
name: testing-backend
description: How to write backend tests for the Vorynth core engine (NestJS + Jest). Use whenever adding or changing engine code — services, controllers, DDL/schema, search, crawler logic — or when the task mentions backend tests, jest, spec files, or domain invariants. Every backend feature ships with its tests; the harness guarantees tests never touch the real database or the network.
---

# Backend Testing — Vorynth

## Purpose

Write engine tests that actually catch regressions: unit tests for pure logic, integration-style tests against a throwaway SQLite database, and **domain-invariant tests** that prove the app's business laws hold. Backend features ship WITH their tests.

## When to use

- Adding or modifying a core-engine service, controller, DTO, or DB layer.
- Any schema/DDL change (pair with `/db-migration`).
- Search/tokenizer/crawler/history/archive logic — pure functions and edge cases.
- "Domain invariant" scenarios: can an invalid state exist?

## Preconditions

- Run `pnpm install` if jest/ts-jest were just added.
- DB-touching changes: take a backup first if the change is destructive (R-C02) — tests use a temp DB and never touch `data/`, but the real DB is still your responsibility during development.

## Workflow

1. **Understand the harness** — files under `apps/core-engine/test/`:
   - `helpers/db.ts` → `createTestDb()`: temp SQLite + migrations applied, returns a `DatabaseService`. Always `close()` it (use `try/finally`).
   - `helpers/mock-llm.ts` → `createMockLlmProvider(overrides)`: offline `LlmProvider` (all methods `jest.fn`). Tests never hit the network.
   - Config: `apps/core-engine/jest.config.cjs` — ts-jest CJS transform + `.js`→`.ts` moduleNameMapper.
2. **Place the test**:
   - Pure logic → `test/unit/<module>.spec.ts` (e.g. `hashing.spec.ts`).
   - Service/DB logic → `test/<module>.spec.ts` or `test/unit/<module>.spec.ts`.
   - Business laws → `test/domain/invariants.spec.ts` (or `test/domain/invariants/<name>.spec.ts`). These are not feature tests — they assert *impossible states stay impossible*: origin without spine, bookmark→missing item, retention never prunes bookmarked content, collection tree depth/parent_type.
3. **Write the test** with `describe`/`it`/`expect` (Jest globals, `@types/jest`). For services that need DI, construct them directly with the `DatabaseService` from `createTestDb()` (or a mock provider) — don't boot the whole Nest app unless you must.
4. **Assert on behavior, not implementation**: the returned data and DB state, not which SQL ran.
5. **Run** `pnpm --filter @vorynth/core-engine test` (single file: `-- test/unit/hashing.spec.ts`).

## Rules

- **Never hit the network.** LLM paths get `createMockLlmProvider`. No real provider calls in tests.
- **Never touch the real DB.** Always `createTestDb()` (temp dir). The harness path override is the ONLY way `DatabaseService` is constructed in tests.
- **Every `createTestDb()` must be closed** — use `try/finally` or `afterAll`.
- **Await every Drizzle write** (R-C03) — a fire-and-forget write vanishes; your test would fail confusingly.
- **Keep the temp DB lean** — don't seed the full source list; insert only the rows your test needs (but note `runMigrations` seeds 13 default sources + settings — account for that in counts).
- **Invariant tests live separately** from feature tests — they document the world's rules, not endpoints.

## Common mistakes

- Constructing `DatabaseService` without a path — that opens the REAL `data/vorynth.sqlite`. Always pass the temp path (via `createTestDb`).
- Forgetting `close()` → leaked file handles and flaky WAL locks on the temp dir.
- Testing `jest.fn` call counts against the mock you passed — assert on observable behavior instead.
- Counting rows without accounting for `seedDefaults()` (sources, settings) inserted by `runMigrations`.
- Writing `raw.transaction(() => {...})` and forgetting to INVOKE it — better-sqlite3's `db.transaction(fn)` returns a function; without the trailing `()`, the whole block silently never runs (this bit the archive/bookmark/source-delete code once — assert DB state AFTER a write, and prefer `const run = db.transaction(fn); run()`).

## Validation

- `pnpm --filter @vorynth/core-engine test` → all suites pass.
- `pnpm typecheck` → engine typechecks (test files are transformed with `isolatedModules`; keep them syntactically clean).
- `pnpm --filter @vorynth/core-engine lint` → no new lint errors in `src` or `test`.
- For DB changes: `/db-migration` validation + `pnpm db:verify-integrity` (once it exists).
