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
import { FTS_BACKFILL_SQL, FTS_VIRTUAL_DDL } from "./fts-schema.js";

const FTS_TABLE = "articles_fts";

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
	author?: string | null,
): void {
	const nTitle = normalizeText(title);
	const nContent = normalizeText(content);
	const nAuthor = normalizeText(author ?? "");
	rawDb
		.prepare(
			"INSERT INTO articles_fts(article_id, title, content, author) VALUES (?, ?, ?, ?)",
		)
		.run(articleId, nTitle, nContent, nAuthor);
}

/**
 * Update an existing article's FTS5 row in place (title/content/author).
 *
 * Used when a job rewrites an article's title or content (e.g. Translate
 * Stories changes `title`) so keyword search keeps matching what the live
 * table displays. `content` is passed by the caller — unchanged fields are
 * simply written back with their current values.
 */
export function ftsUpdateArticle(
	rawDb: Database.Database,
	articleId: string,
	title: string,
	content: string,
	author?: string | null,
): void {
	rawDb
		.prepare(
			"UPDATE articles_fts SET title = ?, content = ?, author = ? WHERE article_id = ?",
		)
		.run(
			normalizeText(title),
			normalizeText(content),
			normalizeText(author ?? ""),
			articleId,
		);
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
	rawDb.exec(FTS_VIRTUAL_DDL);

	// Backfill.
	const { changes } = rawDb.prepare(FTS_BACKFILL_SQL).run();
	return changes;
}

/**
 * Ensure the FTS5 table matches the current schema, rebuilding when needed.
 *
 * FTS5 virtual tables cannot be ALTERed. If the table predates the `author`
 * column (added v1.6.0), drop and recreate + backfill — derived, rebuildable
 * data (R-A09). Called from `runMigrations` on every startup; idempotent.
 */
export function ensureFtsSchema(rawDb: Database.Database): number {
	const cols = rawDb
		.prepare(`PRAGMA table_info(${FTS_TABLE})`)
		.all() as Array<{ name: string }>;
	if (cols.length > 0 && !cols.some((c) => c.name === "author")) {
		rawDb.exec(`DROP TABLE IF EXISTS ${FTS_TABLE}`);
	}
	rawDb.exec(FTS_VIRTUAL_DDL);
	const { changes } = rawDb.prepare(FTS_BACKFILL_SQL).run();
	return changes;
}
