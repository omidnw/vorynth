import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { ContentItemType } from "@vorynth/types";

/**
 * Archive spine helpers (v1.6.0).
 *
 * `content_items` is the metadata-only organization spine (R-A09). Owning
 * services create a spine row and attach their origin row to it **in the same
 * transaction** — the domain invariant is "every origin has exactly one
 * spine". The startup `ensureSpines()` backfill repairs any gap.
 */

/** The origin tables that claim a spine row, keyed for safe SQL. */
export type OriginTable =
	"articles" | "search_history" | "brief_history" | "generated_history";

const ATTACH_SQL: Record<OriginTable, string> = {
	articles: "UPDATE articles SET content_item_id = ? WHERE id = ?",
	search_history: "UPDATE search_history SET content_item_id = ? WHERE id = ?",
	brief_history: "UPDATE brief_history SET content_item_id = ? WHERE id = ?",
	generated_history:
		"UPDATE generated_history SET content_item_id = ? WHERE id = ?",
};

/** Insert a new spine row and return its id. */
export function createSpine(
	rawDb: Database.Database,
	contentType: ContentItemType,
	at: Date = new Date(),
): string {
	const id = randomUUID();
	rawDb
		.prepare(
			"INSERT INTO content_items (id, content_type, created_at, updated_at) VALUES (?, ?, ?, ?)",
		)
		.run(id, contentType, at.getTime(), at.getTime());
	return id;
}

/** Attach an origin row to a spine (set its content_item_id). */
export function attachSpine(
	rawDb: Database.Database,
	table: OriginTable,
	originId: string,
	contentItemId: string,
): void {
	rawDb.prepare(ATTACH_SQL[table]).run(contentItemId, originId);
}

/** True when an origin row already has a spine attached. */
export function hasSpine(
	rawDb: Database.Database,
	table: OriginTable,
	originId: string,
): boolean {
	const row = rawDb
		.prepare(`SELECT content_item_id FROM ${table} WHERE id = ?`)
		.get(originId) as { content_item_id: string | null } | undefined;
	return Boolean(row?.content_item_id);
}

/**
 * Delete archive spines that no origin row claims (R-A09 — the spine is
 * derived metadata; an unclaimed spine shows up in the Archive as a ghost
 * "Untitled" item and inflates its count). Idempotent and invariant-preserving:
 * only rows absent from ALL four origin tables are touched, so an article /
 * search / brief / generated row's spine is never removed. Returns the number
 * of orphaned spines deleted.
 *
 * Origin rows are expected to remove their spine in the same transaction as
 * the origin delete (see `sources.service.remove`); this sweep is the backstop
 * for paths that don't (retention pruning) plus a startup repair.
 */
export function sweepOrphanSpines(rawDb: Database.Database): number {
	const { changes } = rawDb
		.prepare(
			`DELETE FROM content_items
			 WHERE id NOT IN (SELECT content_item_id FROM articles WHERE content_item_id IS NOT NULL)
			   AND id NOT IN (SELECT content_item_id FROM search_history WHERE content_item_id IS NOT NULL)
			   AND id NOT IN (SELECT content_item_id FROM brief_history WHERE content_item_id IS NOT NULL)
			   AND id NOT IN (SELECT content_item_id FROM generated_history WHERE content_item_id IS NOT NULL)`,
		)
		.run();
	return changes;
}
