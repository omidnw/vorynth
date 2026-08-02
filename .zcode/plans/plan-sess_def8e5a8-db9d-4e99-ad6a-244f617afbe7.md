# Vorynth 1.6.0 — "Navigate the Maze" (plan v9, FINAL — approved with action items folded in)

Folds into the existing 1.6.0 release, codename renamed to **"Navigate the Maze"**. Bookmark-only save model (flag on a content item). Stack: **Jest (backend) + Vitest (UI) + Playwright (e2e, critical journeys) + Storybook**. Manual organization now; LLM-assisted organization deferred to next release. Implementation contract — schema/API locked.

## 🔒 Locked decisions

- **Bookmark = flag**: `bookmarks(content_item_id UNIQUE)`, generic — no `article_id`, no `bookmark` content_type. Future bookmarking of AI answers/summaries = migration-free.
- **ALL generated artifacts are immutable archive items** — summaries, insights, translations, explanations, recommendations, AI notes. Regeneration creates a new content item linked to the same origin; never overwrites history (knowledge timeline). **1.6 content_type umbrella: `summary`** for all generated artifacts; finer types (translation/recommendation/AI-notes) expand later.
- **Spine is metadata-only** — no title/url/snippet snapshots (no drift with Translate-Titles).
- **Domain ownership**: a bookmark (and future protected references) is user ownership of a reference — never silently destroyed. Deletion rule, generic: **"an owning origin is removed with its spine only when no protected references remain; operations that would destroy user-owned data must preserve it, require explicit confirmation, or offer a recovery path."** Concretely: (a) retention pruning skips bookmarked articles; (b) source deletion refused by default when bookmarked articles exist (`409 BOOKMARKED_ARTICLES_EXIST`); `?force=true` + UI confirmation deletes source + articles + spines + bookmarks in one transaction (explicit consent — allowed); (c) deleting a bookmark removes only the flag; (d) `db:verify-integrity` proves zero orphan spines / zero bookmark→missing-item after any deletion path.
- **Collection delete → items move to uncategorized** (SET NULL); children re-parent. Never cascade-deletes content.
- **Migration stays additive (R-A01)** — nullable FK columns + service-layer NOT NULL invariant (no shipped-table rebuild).
- **Transparency v1 = stored signals only** — ranking factors + provenance (evidence, not AI stories about its own reasoning).

## 1. Data model (ERD — locked)

```
content_items  (spine — metadata ONLY)
┌──────────────────────────────────────────────┐
│ id TEXT PK                                   │
│ content_type CHECK IN ('article','summary',  │
│   'keyword-search','ai-ask')                 │
│ note TEXT                                    │
│ collection_id FK → collections.id (SET NULL) │
│ archived_at / created_at / updated_at        │
└──────────────────────────────────────────────┘

collections                                    bookmarks
┌──────────────────────────────────────────────┐ ┌──────────────────────────────────┐
│ id TEXT PK                                  │ │ id TEXT PK                       │
│ name TEXT NOT NULL                          │ │ content_item_id FK UNIQUE        │
│ description TEXT                            │ │   → content_items (CASCADE)      │
│ parent_id FK → collections.id (SET NULL)    │ │ created_at                       │
│ kind CHECK IN ('category','folder')         │ └──────────────────────────────────┘
│ llm_generated INT DEFAULT 0                 │
│ created_at / updated_at                     │
└──────────────────────────────────────────────┘

tags              content_item_tags
┌────────────────┐ ┌──────────────────────────────────┐
│ id TEXT PK     │ │ content_item_id FK (CASCADE)     │
│ name UNIQUE    │ │ tag_id FK (CASCADE)              │
│ created_at     │ │ PK (content_item_id, tag_id)     │
└────────────────┘ └──────────────────────────────────┘

origin tables (existing, each gains one column — FK UNIQUE → content_items.id)
articles          content_item_id      (one spine per article row; Article DTO exposes contentItemId)
search_history    content_item_id      (mode → keyword-search | ai-ask; one spine per record)
brief_history     content_item_id      (→ summary; one spine per generation — immutable)
generated_history content_item_id      (→ summary; one spine per generation — immutable)
```

**Invariants (business laws, `tests/domain/invariants/`):** every origin row has exactly one spine; spine+origin created in the same transaction; an owning origin is removed with its spine only when no protected references remain; retention never prunes bookmarked content; source deletion without `force` is refused when bookmarked articles exist; source deletion with `force` leaves no orphans; deleting a bookmark keeps article + spine; bookmark cannot point at a missing item; collection tree obeys parent_type (category→folders, folder→folders/items) and `MAX_COLLECTION_DEPTH = 3` (soft service constant).

## 2. Migration sequence (SQLite, `/db-migration`, 🔴 `/backup` first)

1. **Backup** (R-C02).
2. `CREATE TABLE IF NOT EXISTS` spine + collections + tags + content_item_tags + bookmarks (additive).
3. `ALTER TABLE ADD COLUMN content_item_id TEXT` + UNIQUE index on the 4 origin tables (nullable, additive — R-A01; NOT NULL at service layer).
4. **Backfill**: `INSERT INTO content_items` per origin row (content_type from origin semantics; created_at from origin's created_at), then `UPDATE origin SET content_item_id`.
5. **Validate** — startup consistency check **+ `pnpm db:verify-integrity` dev command** (permanent health check): zero origins-without-spine / zero orphan spines / zero bookmark→missing-item.
6. **FTS**: add `author` column to `articles_fts` → `ftsRebuildIndex`.
7. Rebuild `@vorynth/types` (R-D02); `pnpm db:migrate` + `/db-migration` validation.

## 3. Initial API contract (locked)

- **Bookmarks** (generic): `POST /bookmarks {contentItemId}` → `409 BOOKMARK_ALREADY_EXISTS` / `404 CONTENT_ITEM_NOT_FOUND` / `400 INVALID_BOOKMARK_TARGET` · `DELETE /bookmarks/:contentItemId` · `GET /bookmarks?limit=&offset=` · `GET /bookmarks/:contentItemId`.
- **Sources**: `DELETE /sources/:id` → `409 {code:'BOOKMARKED_ARTICLES_EXIST', bookmarkedCount}` when bookmarked articles exist; `DELETE /sources/:id?force=true` proceeds (one transaction). `GET /sources/:id/articles?range=day|week|month|year|from&to=` → `{articles, prunedNote?}` (informational over surviving data; explainer when window predates retention).
- **Archive**: `GET /archive/items?contentType=&collectionId=&tag=&q=&archived=&limit=&offset=` → `{items, total, hasMore}` (per-kind join for title/url; **curated default = bookmarked + newest non-archived `ORDER BY created_at DESC LIMIT 50`**; "All" filter; offset now, cursor >100k) · `GET /archive/items/:id` (full origin detail) · `PATCH /archive/items/:id {note?, tags?, collectionId?, archived?}` · `GET/POST/PATCH/DELETE /archive/collections` (tree; parent_type + depth checks on write).
- **History search**: `GET /history/search?q=&type=&includeArchived=` → unified `{id, type, title, createdAt, archived}` (type selects the existing detail page).
- **Search**: `GET /search` gains `author=` · `GET /search/advanced?q=&domains=&importance=&from=&to=&authors=&sources=&hasInsight=`.
- **Transparency**: `GET /brief` items gain `ranking {sourceReliability, freshnessScore, lengthSignal, importanceTier, score}` + `provenance {adapter, hash, collectedAt, sourceName}` (stored signals only).

## 4. Scope tiers

| Tier | Items |
| --- | --- |
| **Must (1.6.0)** | Testing foundation + domain-invariant tests; migration; persisted bookmarks (flag model; icon + own page); Archive (unified items, collections/folders, tags, notes, move — manual); search relocated into Archive (deep-link contract + Playwright regression); sources range windows; history search; Documentation/Tutorial page + transparency; Changelog general/technical "show more"; a11y baseline |
| **Should (cut if late)** | Author search; Advanced researcher search on the Brief |
| **Later (next release)** | LLM-assisted organization (organize job, auto-tagging, auto-arrange); **delete-impact preview for destructive ops** (`GET /sources/:id/delete-impact` → `{articles, bookmarks, summaries}` before force); **`GET /archive/items/:id/related`** (knowledge-timeline grouping: article → its summaries/translations); finer generated content_types; cursor pagination (>100k); `archive_fts` when LIKE inadequate |

## 5. Phases

- **Phase 0 — Foundation**: Jest+ts-jest + temp-SQLite/migration harness + mocked `LlmProvider` (no network in tests); Vitest config + testing-library/jsdom; a11y baseline; skills `testing-backend`, `testing-frontend` (aria/role only, no `data-test-id`), `docs-update`; **AGENTS.md updates** — Testing Strategy; architecture rules **Domain Data Integrity** (never duplicate mutable domain data into derived/index/cache tables — FTS drift was a symptom of duplicated truth) and **Domain Ownership** (user-owned references never disappear silently: preserve / explicit confirmation / recovery path); category/folder semantics + depth. Playwright/Storybook scaffolded once features exist; **e2e = critical journeys** (collect → bookmark → archive → search → history → docs) + `/search?q=&mode=` redirect regression.
- **Phase 1 — Migration** (sequence above; verify via `pnpm db:verify-integrity`).
- **Phase 2 — Backend Must + Jest tests**: bookmarks, archive, collections, sources windows + deletion semantics, history search, transparency DTOs; **domain-invariant test group in `tests/domain/invariants/`** (spine-without-origin; bookmark→missing item; retention-vs-bookmark; source-delete-refused-without-force; source-delete-force-no-orphans; bookmark-delete-keeps-article+spine; tree depth/parent_type).
- **Phase 3 — Backend Should + tests**: author filter, advanced search. Parallel/cuttable.
- **Phase 4 — Frontend Must + Vitest/Playwright**: Archive page, Bookmarks page, search relocation (params preserved), bookmark icons (real save replacing cosmetic `useState`; sends `contentItemId`), source-delete confirmation flow (count of saved stories at risk, "Delete anyway"), Sources range filter + retention explainer, history search UI, `/docs` page (per-page guides, bidirectional links, few interactive demos reusing Storybook mocks, transparency framed as "Why this story / ranking / summary / recommendation?"), Changelog show-more (`technical?` optional), i18n in `en.ts`.
- **Phase 5 — Frontend Should**: Brief advanced-search panel.
- **Phase 6 — Storybook**: component + page stories (docs demos reuse).
- **Phase 7 — Closeout**: changelog 1.6.0 "Navigate the Maze" (general + technical), `pnpm version:check`, README/docs touch-ups, roadmap + `/session-archive`.

## 6. Verification (per R-Q01)

`pnpm typecheck` (both apps) · `pnpm lint` · jest (core, incl. invariant group) · vitest (desktop) · playwright critical journeys · storybook build · `pnpm db:verify-integrity` · manual archive/bookmark/search/brief flows + source-delete confirmation against a real engine (LLM 5 rpm) · `/db-migration` validation.

**Risks/notes**: backup before migration (R-C02); FTS rebuild for author; rebuild `@vorynth/types` (R-D02); no commits without explicit approval (R-C01); spine metadata-only; immutable generations; generic bookmarks; additive-only migration; transparency = stored signals only; deletion safety covered for every path (retention / source / bookmark).