/**
 * FTS5 schema for Vorynth full-text search.
 *
 * Uses a standalone FTS5 virtual table (no `content=` option) with an
 * UNINDEXED `article_id` column so we can JOIN back to the articles table.
 *
 * Tokenizer: `unicode61` with `remove_diacritics 2` (Arabic/Persian
 * diacritics stripped) and prefix indexes for fast prefix queries.
 *
 * Sync is handled at the application level (crawler.service.ts) since
 * SQLite does not allow triggers from other tables to write into FTS5
 * shadow tables.
 */

// ── FTS5 virtual table ─────────────────────────────────────────────────────
// Standalone — stores its own copy of title + content, plus the article UUID.
// Tokenizer options:
//   remove_diacritics 2  — strip Arabic/Persian diacritics (tashkeel)
//   prefix '2 3'         — enable fast prefix queries for 2/3-char terms

export const FTS_VIRTUAL_DDL = `\
CREATE VIRTUAL TABLE IF NOT EXISTS articles_fts USING fts5(
  article_id UNINDEXED,
  title,
  content,
  tokenize='unicode61 remove_diacritics 2',
  prefix='2 3'
);
`;

// ── Bulk insert (for migration backfill) ───────────────────────────────────

export const FTS_BACKFILL_SQL = `\
INSERT OR IGNORE INTO articles_fts(article_id, title, content)
SELECT id, normalize_fts(title), normalize_fts(content) FROM articles;
`;
