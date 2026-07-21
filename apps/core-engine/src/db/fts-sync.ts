/**
 * FTS5 sync helpers — keep the full-text search index in sync with articles.
 *
 * These are called from the crawler and sources services where articles are
 * inserted, updated, or deleted.
 *
 * NOTE: FTS5's built-in 'delete' command does not work in the SQLite version
 * bundled with better-sqlite3 11.x (SQLite 3.51). Instead we rely on:
 *   • INNER JOIN in search queries to filter out deleted articles
 *   • In-memory deduplication for re-inserted articles (force-crawl)
 *   • Occasional full rebuild via ftsRebuildIndex()
 */
import type Database from "better-sqlite3";
import { normalizeText } from "../search/text-normalizer.js";

const FTS_TABLE = "articles_fts";

// ── DDL ────────────────────────────────────────────────────────────────────

const FTS_DDL = `\
CREATE VIRTUAL TABLE IF NOT EXISTS ${FTS_TABLE} USING fts5(
  article_id UNINDEXED,
  title,
  content,
  tokenize='unicode61 remove_diacritics 2',
  prefix='2 3'
);
`;

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Insert a new article into the FTS5 index.
 *
 * Called after an article is inserted into the `articles` table. There is no
 * corresponding delete — the search query's INNER JOIN with the articles
 * table naturally filters out deleted articles.
 */
export function ftsInsertArticle(
	rawDb: Database.Database,
	articleId: string,
	title: string,
	content: string,
): void {
	const nTitle = normalizeText(title);
	const nContent = normalizeText(content);
	rawDb
		.prepare(
			"INSERT INTO articles_fts(article_id, title, content) VALUES (?, ?, ?)",
		)
		.run(articleId, nTitle, nContent);
}

/**
 * Rebuild the FTS5 index from scratch.
 *
 * Drops the virtual table, recreates it, and backfills all articles from
 * the articles table (using normalize_fts for Persian normalization).
 *
 * This is called after major operations (force-crawl, source deletion) to
 * eliminate stale/duplicate entries.
 */
export function ftsRebuildIndex(rawDb: Database.Database): number {
	// Drop and recreate.
	rawDb.exec(`DROP TABLE IF EXISTS ${FTS_TABLE}`);
	rawDb.exec(FTS_DDL);

	// Backfill.
	const { changes } = rawDb
		.prepare(
			`INSERT INTO ${FTS_TABLE}(article_id, title, content)
       SELECT id, normalize_fts(title), normalize_fts(content) FROM articles`,
		)
		.run();
	return changes;
}
