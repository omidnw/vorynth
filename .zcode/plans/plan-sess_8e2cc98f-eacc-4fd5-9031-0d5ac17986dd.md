## Goal
Make collection naming rules explicit and safe in the v1.6.0 Archive:

- **Cross-kind same-name is ALLOWED** — a folder "Work" and a category "Work" under the same parent coexist (their `kind` differs; no name-based addressing exists in v1.6.0, so no complexity — answers "مگه type هاشون فرق نداره").
- **Same-kind duplicate is refused with a clear 409** — two folders (or two categories) with the same name under the same parent throw `ConflictException` instead of silently duplicating (answers "باید خطا بدی").

Currently neither case is checked anywhere (service has no check, DB has no unique index, UI swallows errors) — duplicates are silently created.

## Changes

**1. Backend — `apps/core-engine/src/modules/archive/archive.service.ts`**
- Add private helper `assertSiblingNameFree(parentId, kind, name, excludeId?)`: queries `collections` for a same-kind sibling with the same name (trimmed, case-insensitive via `LOWER`) under the same parent; throws `ConflictException({ code: "COLLECTION_NAME_CONFLICT", message })` with a kind-aware message, e.g. `A folder named "Work" already exists here.`
- `createCollection`: trim the name, call the check before insert.
- `updateCollection`: when name/parentId/kind change, compute the target (parent, kind, name) and check excluding self (rename-to-sibling-name and move-into-conflicting-parent both covered).
- Import `ConflictException` (pattern: `sources.service.ts` / `bookmarks.service.ts`).

**2. DB — additive backstop (R-A01)**
- `apps/core-engine/src/db/ddl.ts`: add `ensureCollectionNameIndex(db)` called from `runMigrations` — creates two partial unique indexes ONLY when no legacy duplicates exist (prevents startup crash on dirty DBs):
  - `CREATE UNIQUE INDEX IF NOT EXISTS idx_collections_parent_kind_name ON collections(parent_id, kind, name COLLATE NOCASE) WHERE parent_id IS NOT NULL`
  - `CREATE UNIQUE INDEX IF NOT EXISTS idx_collections_root_kind_name ON collections(kind, name COLLATE NOCASE) WHERE parent_id IS NULL`
- `apps/core-engine/src/db/schema.ts`: brief comment on the `collections` table noting the sibling-name unique index lives in `ddl.ts` (keeps DDL↔schema sync narrative; current DB has 2 collections, no duplicates — index is safe to create).
- **Precondition: DB backup first** (R-C02 → `/backup` skill) before the migration runs.

**3. Frontend — `apps/desktop/src/features/archive/CollectionsExplorer.tsx`**
- `CreateForm`: on failure keep the form open and show `createMutation.error.message` inline (`text-error` paragraph — same pattern as `SourcesPage.tsx:933`); close only on success.
- Rename: surface the conflict message inline near the node instead of silently dropping it.
- No native browser dialogs (R-A12).

**4. Docs — `apps/desktop/src/features/docs/sections/archive.ts`**
- Add a bullet about the naming rule: folders and categories may share a name side by side (different types); two folders or two categories with the same name in the same place are refused (R-D06).

**5. Tests — new `apps/core-engine/test/domain/collection-name-conflict.spec.ts`**
- cross-kind same-name under same parent → allowed
- same-kind duplicate → 409
- two root categories with same name → 409
- same name under different parents → allowed
- rename to a same-kind sibling name → 409; rename to a cross-kind name → allowed
- case-insensitive collision ("Work" vs "work") → 409

## Verification
- `pnpm --filter @vorynth/core-engine typecheck` + run jest (new spec + full suite)
- `pnpm --filter @vorynth/desktop typecheck`
- Lint on touched files
- Manual: Archive → Collections explorer — create folder "Work" + category "Work" under same parent (both appear), then a second folder "Work" (inline error shown, form stays open)

## Files touched
- `apps/core-engine/src/modules/archive/archive.service.ts`
- `apps/core-engine/src/db/ddl.ts`, `apps/core-engine/src/db/schema.ts`
- `apps/desktop/src/features/archive/CollectionsExplorer.tsx`
- `apps/desktop/src/features/docs/sections/archive.ts`
- `apps/core-engine/test/domain/collection-name-conflict.spec.ts` (new)