# Vorynth — Project rules for ZCode

## 🔴 Backup first — non-negotiable

**Before ANY destructive operation** (database migration, file deletion, schema change, data manipulation, refactoring existing code, or running `rm`, `drop`, `delete` on anything), create a timestamped backup of the SQLite database first:

```bash
# Stop the engine first if running, then:
cp apps/core-engine/data/vorynth.sqlite apps/core-engine/data/backups/vorynth-$(date -u +%Y-%m-%dT%H-%M-%SZ).sqlite
```

Or use the `/backup` skill if it's available. The backup goes in `apps/core-engine/data/backups/`.

**The one exception:** reading a file or running `pnpm typecheck` — those are safe.

## Code style

- **Indentation:** tabs, not spaces.
- **Language:** TypeScript with strict mode.
- **Idiom:** Match the surrounding code's comment density, naming convention (`camelCase` for variables/functions, `PascalCase` for classes/types, `SCREAMING_SNAKE_CASE` for constants), and module pattern.
- **Quotes:** double quotes for TypeScript, single quotes for SQL strings inside TypeScript.
- **Imports:** use `import type` for type-only imports.
- **Exports:** named exports only (no `export default`).

## Architecture

| Layer        | Location                  | Stack                                 |
| ------------ | ------------------------- | ------------------------------------- |
| Core engine  | `apps/core-engine/`       | NestJS + better-sqlite3 + Drizzle ORM |
| Desktop      | `apps/desktop/`           | React + Vite + Tailwind CSS           |
| Shared types | `packages/types/`         | TypeScript interfaces only            |
| Plugins      | `apps/desktop/src-tauri/` | Tauri v2                              |

- Database: single SQLite file at `apps/core-engine/data/vorynth.sqlite`.
- FTS5: `articles_fts` virtual table — synced at application level.
- Text normalization: `@persian-tools/persian-tools` + `Intl.Segmenter`.

## Version sync

When bumping version, update **all 5 files** to the same string:

1. `package.json` (root)
2. `apps/core-engine/package.json`
3. `apps/desktop/package.json`
4. `apps/desktop/src-tauri/tauri.conf.json` → `"version"`
5. `apps/desktop/src-tauri/Cargo.toml` → `version = "..."`

## Changelog

For meaningful changes, use the changelog skill (`/changelog`). See `.agents/skills/changelog/SKILL.md`.

## Standard packages over hand-rolled code

Before writing custom logic for anything standardised (language lists, date formatting, text normalisation, etc.), check for a well-maintained package first. See the `/standard-packages` skill at `.agents/skills/standard-packages/SKILL.md` for the quality bar and decision flow.

## Before making changes

1. **Backup the DB** → `/backup`
2. **Read the file** before editing (the Edit tool requires it)
3. **Typecheck** after changes → `pnpm --filter @vorynth/core-engine typecheck`
4. **Check desktop too** → `pnpm --filter @vorynth/desktop typecheck`

## 🔴 NEVER commit or push without explicit approval

**I NEVER run `git commit`, `git push`, or any equivalent command** unless the user explicitly tells me to — for example "commit this", "push it", "submit a PR", or similar clear instruction.

- Showing the diff, suggesting a commit message, staging changes: ✅ OK (with permission)
- Actually committing or pushing: ❌ **FORBIDDEN without user saying so**
- This applies to ALL branches, including `master`.
- "Go ahead", "do it", "apply the changes", "fix it" — these are NOT commit permission. The user must explicitly say "commit" or "push".
- If unsure, ask. NEVER assume.

Violating this rule is a serious breach of trust. The user reviews everything before it reaches the remote.
