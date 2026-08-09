# Source Metadata — the "source intelligence layer" data

> **Status:** v1.8.0 — data-holding layer. The fields are stored, editable, and
> surfaced in the UI; the intelligence/ranking layer that _reasons_ over them
> is a later step. This document is the contract for that step.

## Why this exists

A source is more than a URL to crawl. To judge _"does this story matter to
me"_ an intelligence engine needs to know not just where a source is from,
but **how broadly it matters**, **how credible it is**, and **what fields it
touches**. Those three axes — plus the origin — are the semantic metadata that
the ranking layer will consume.

The abstraction is deliberately split from the _crawl method_ (adapter):
a source is an entity; the adapter is a capability. Nothing here depends on
RSS/API/HTML.

## The model

```ts
// packages/types/src/index.ts

/** How broadly a source's subject matters — the "who does it affect" axis. */
type SourceScope =
	| "global" // worldwide infrastructure/standards (Cloudflare, AWS)
	| "regional" // matters across a continent/region
	| "national" // matters within one country
	| "local" // city/community level
	| "community"; // niche but devoted audience (a subreddit, a meetup blog)

/** The source's credibility class — the "how much should we trust it" axis. */
type SourceAuthority =
	| "official" // the organization itself (OpenAI Blog)
	| "research" // papers / academic (arXiv)
	| "community" // forums / aggregations with community voice (Hacker News)
	| "media" // journalism (a news outlet, an independent reporter)
	| "aggregator" // re-publishes others' content
	| "personal"; // an individual's blog (Simon Willison, Julia Evans)
```

Each `Source` row carries:

| Field         | Type              | Meaning                                                                               |
| ------------- | ----------------- | ------------------------------------------------------------------------------------- |
| `origin`      | `country/city`    | Where the publisher is from (ISO country, free-text city) — already shipped in v1.8.0 |
| `scope`       | `SourceScope`     | Who the source's subject matters to                                                   |
| `authority`   | `SourceAuthority` | How credible it is                                                                    |
| `impactAreas` | `string[]`        | What fields it touches (lowercase slugs)                                              |

`null` on any field = _not yet classified_ (user rows start unclassified).

## Storage (SQLite)

| Column         | SQL type | Notes                                      |
| -------------- | -------- | ------------------------------------------ |
| `scope`        | `TEXT`   | enum value; validated in the service layer |
| `authority`    | `TEXT`   | enum value; validated in the service layer |
| `impact_areas` | `TEXT`   | JSON array of strings; parsed in the DTO   |

Decisions:

- **Enums as TEXT columns, not a lookup table.** They are filtered/grouped by
  (`GROUP BY scope`) and additive `ALTER TABLE ADD COLUMN` is the only allowed
  migration — a join table would add indirection without a querying win.
- **`impact_areas` as a JSON TEXT column, not a join table.** The data is a
  per-source attribute (not a shared entity), arrays are small (≤12 slugs),
  and SQLite's JSON1 functions can query into it later without a schema
  change. A normalized `source_impact_areas` table is a v2 option if we need
  to index by area at scale.
- **Validation lives in the service layer** (`sources.service.ts`):
  - `scope`/`authority` must be a member of the shared enum
    (`INVALID_SOURCE_SCOPE` / `INVALID_SOURCE_AUTHORITY` otherwise).
  - `impactAreas` must be an array of strings; each is normalized to a
    lowercase hyphenated slug (`"AI"` → `"ai"`), deduped, capped at 12.
    Free-form slugs are accepted (like categories) — the curated
    `SOURCE_IMPACT_AREAS` vocabulary is a UI suggestion, not a constraint.

## Migration

Additive only (R-A01), in `db/ddl.ts` `ADDITIVE_DDLS`:

```sql
ALTER TABLE sources ADD COLUMN scope TEXT;
ALTER TABLE sources ADD COLUMN authority TEXT;
ALTER TABLE sources ADD COLUMN impact_areas TEXT;
```

`db/schema.ts` mirrors the columns for Drizzle. Existing databases are
backfilled by `backfillSeedTags` — guarded `WHERE id = ? AND scope IS NULL AND
authority IS NULL`, so a user's own classification is never overwritten and
re-runs are no-ops.

## Seed classifications

The 24 official sources are classified in `SEED_SOURCE_METADATA` (keyed by
seed id, so seed rows stay pure identity). Values are best-effort curated;
users can correct any of them in the Edit form. Summary: all 24 are
`scope: global`; `authority` is `official` for company/org blogs
(OpenAI, AWS, Cloudflare, …), `media` for journalism (Krebs on Security,
Smashing Magazine), `personal` for individual blogs (Martin Fowler, Simon
Willison, Julia Evans). Impact areas use the curated vocabulary
(`ai`, `security`, `cloud`, `internet`, `architecture`, `programming-languages`, …).

Community list files (`sources/`) may carry optional `scope`/`authority`/
`impactAreas` per source definition; they are parsed leniently (unknown enum
values drop to `null`, never reject the list).

## What this layer does NOT do yet (honest scope)

- No ranking/relevance scoring consumes these fields.
- No "is this source reliable" computation (a future `reliabilityScore`
  belongs here).
- No source health/stats (fetch failures, article counts) — those are
  crawler-observability concerns, not metadata.

The abstraction is the contract; the intelligence is future work.

## Future extensions (design notes)

- A source may belong to multiple lists — a `source_list_items` join table
  (instead of the current single `list_id`) would enable one source in several
  curated groups. Deferred: the current one-to-one keeps edits unambiguous.
- `reliabilityScore` (computed), `health` (fetch outcomes), `stats`
  (articles collected, last article) can be added as more additive columns
  without touching this model.
