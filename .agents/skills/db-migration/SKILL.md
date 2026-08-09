---
name: db-migration
description: Perform a Vorynth database schema change the safe way — additive DDL only, schema.ts + ddl.ts kept in sync, FTS5 re-sync, backup first. Use whenever a new table, column, or index is needed, or any schema evolution. Trigger automatically when a task mentions adding a column/table, changing the data model, or touching schema.ts/ddl.ts.
---

# DB Migration — Vorynth

## Purpose

Change the Vorynth database schema safely — additive DDL only, `schema.ts` + `ddl.ts` kept in sync, FTS5 re-synced, backup first.

Vorynth uses a **programmatic, idempotent DDL** pattern (NOT drizzle-kit migrations). Every schema change must follow this skill — a typo can wipe data; a data-loss incident already happened once.

## When to use

- Adding a new table, column, or index
- Changing column semantics (defaults, nullability, types)
- Touching `schema.ts` or `ddl.ts`
- FTS5 changes (`fts-schema.ts`)

## The core pattern

Two files must stay **in sync, in parallel**:

| File                                | Role                                                          |
| ----------------------------------- | ------------------------------------------------------------- |
| `apps/core-engine/src/db/schema.ts` | Drizzle table definitions (the app reads/writes through this) |
| `apps/core-engine/src/db/ddl.ts`    | Raw SQL executed at startup (`DDL` + `ADDITIVE_DDLS`)         |

**Golden rule: additive only.** Never edit an existing `CREATE TABLE IF NOT EXISTS` block to change a column that already shipped — existing databases won't re-run it. Use `ADDITIVE_DDLS` (ALTER TABLE) for evolution, or a new `CREATE TABLE IF NOT EXISTS` for new tables.

## Workflow

1. **Backup the DB** → `/backup` (non-negotiable, before writing any code).
2. **New table?** Add to BOTH:
   - `schema.ts` — new `sqliteTable(...)` definition.
   - `ddl.ts` — `CREATE TABLE IF NOT EXISTS ...` inside the `DDL` template string.
3. **New column on an existing table?** Add to BOTH:
   - `schema.ts` — column on the existing table definition (so new DBs and the ORM know it).
   - `ddl.ts` — `ADDITIVE_DDLS` array entry: `"ALTER TABLE <table> ADD COLUMN <col> <type> [NOT NULL DEFAULT ...]"`.
4. **Column is `NOT NULL`?** It MUST have a `DEFAULT` in the ALTER — SQLite can't add a NOT NULL column to a non-empty table without one.
5. **Shared types?** Update `packages/types/src/index.ts` interfaces that describe the entity, then **rebuild types**: `pnpm --filter @vorynth/types build`.
6. **FTS5 impact?** If the change affects articles/searchable text, update `fts-schema.ts` (`FTS_VIRTUAL_DDL` / `FTS_BACKFILL_SQL`) and re-sync the FTS table (application-level sync — SQLite triggers CANNOT write FTS5 shadow tables).
7. **Verify** — see below.

## Rules

- `DDL` statements must be idempotent: `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`.
- `ADDITIVE_DDLS` entries are run with per-statement try/catch so a duplicate/failed ALTER doesn't kill startup — keep that behavior.
- Never delete a column/table that shipped — deprecated columns stay (or get a dedicated, user-approved cleanup migration).
- Match the existing style: single quotes for SQL strings, `TEXT PRIMARY KEY` ids, `unixepoch() * 1000` timestamps.
- New FTS5 tables: standalone (no `content=` option), `article_id UNINDEXED`, `tokenize='unicode61 remove_diacritics 2'`, `prefix='2 3'`.

## Common mistakes (gotchas)- **Editing an existing CREATE TABLE** for a column that already shipped → live DBs never get the column, Drizzle schema and real DB drift silently. Use ALTER TABLE instead.

- **Adding NOT NULL without DEFAULT** → `ALTER TABLE` fails on non-empty tables.
- **Updating schema.ts only** → app reads fail against real DBs; **updating ddl.ts only** → Drizzle ORM errors on unknown columns.
- **Forgetting to rebuild `@vorynth/types`** → engine keeps using stale types (nest --watch does not rebuild workspace deps).
- **Trusting FTS5 triggers** → FTS5 shadow tables can't be written by triggers; sync happens at application level (backfill via `INSERT OR IGNORE`, deletes via INNER JOIN + Set dedup — FTS5 DELETE is unreliable in SQLite 3.51).
- **No backup** → a bad migration wipes data with no recovery.

## Validation

After the change:

1. `pnpm --filter @vorynth/types build` (if types changed)
2. `pnpm --filter @vorynth/core-engine typecheck`
3. Start the engine (`pnpm dev:core`) — it auto-migrates on boot; watch the log for `ADDITIVE_DDLS` execution errors.
4. Query the DB to confirm the change landed:
   ```bash
   sqlite3 apps/core-engine/data/vorynth.sqlite "PRAGMA table_info(<table>);"
   ```
5. Exercise the affected flow end-to-end (create → read → update → delete) in the UI or via the API.
