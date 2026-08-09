import Database from "better-sqlite3";
import { resolveDbPath } from "./paths.js";

/**
 * Integrity verifier: `pnpm db:verify-integrity`.
 *
 * Proves the database is sane against the domain invariants (R-A09/R-A10):
 *   1. every origin row (articles / search_history / brief_history /
 *      generated_history) has exactly one archive spine row;
 *   2. no orphan content_items (spines not claimed by any origin);
 *   3. no bookmark points at a missing content item.
 *
 * Exits 1 with a report when any invariant is violated. This is also run as a
 * startup consistency check after migrations. Expects a migrated schema —
 * run `pnpm db:migrate` first.
 */
function main(): void {
	const filePath = resolveDbPath();
	const db = new Database(filePath);
	db.pragma("foreign_keys = ON");

	const problems: string[] = [];

	// Schema guard — give a clear message instead of "no such column".
	const hasSpine =
		(db
			.prepare(
				"SELECT name FROM sqlite_master WHERE type='table' AND name='content_items'",
			)
			.get() as { name?: string } | undefined) !== undefined;
	if (!hasSpine) {
		console.error(
			"✗ content_items table missing — run `pnpm db:migrate` first.",
		);
		db.close();
		process.exit(1);
	}

	// 1. Origins without a spine.
	const originTables: Array<[string, string]> = [
		["articles", "articles"],
		["search_history", "search-history rows"],
		["brief_history", "brief-history rows"],
		["generated_history", "generated-history rows"],
	];
	for (const [table, label] of originTables) {
		const { c } = db
			.prepare(
				`SELECT COUNT(*) AS c FROM ${table} WHERE content_item_id IS NULL`,
			)
			.get() as { c: number };
		if (c > 0) problems.push(`${c} ${label} without an archive spine`);
	}

	// 2. Orphan spines — content_items no origin claims.
	const orphans = db
		.prepare(
			`SELECT ci.id FROM content_items ci
			 LEFT JOIN articles a ON a.content_item_id = ci.id
			 LEFT JOIN search_history s ON s.content_item_id = ci.id
			 LEFT JOIN brief_history b ON b.content_item_id = ci.id
			 LEFT JOIN generated_history g ON g.content_item_id = ci.id
			 WHERE a.id IS NULL AND s.id IS NULL AND b.id IS NULL AND g.id IS NULL`,
		)
		.all() as Array<{ id: string }>;
	if (orphans.length > 0)
		problems.push(`${orphans.length} orphan content items`);

	// 3. Bookmarks pointing at missing items.
	const badBookmarks = db
		.prepare(
			`SELECT bk.id FROM bookmarks bk
			 LEFT JOIN content_items ci ON ci.id = bk.content_item_id
			 WHERE ci.id IS NULL`,
		)
		.all() as Array<{ id: string }>;
	if (badBookmarks.length > 0)
		problems.push(`${badBookmarks.length} bookmarks pointing at missing items`);

	db.close();

	if (problems.length > 0) {
		console.error("✗ Integrity problems:");
		for (const p of problems) console.error(`  - ${p}`);
		process.exit(1);
	}
	console.log("✓ Database integrity OK");
}

main();
