import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { ArchiveService } from "../../src/modules/archive/archive.service.js";
import { HistoryService } from "../../src/modules/history/history.service.js";
import { TrashService } from "../../src/modules/trash/trash.service.js";
import { createTestDb, type TestDb } from "../helpers/db.js";

/**
 * Trash — retention sweep (v1.7.0).
 *
 * `TrashService.run()` (daily, from the scheduler) permanently purges trash
 * older than `trash.retentionValue` × `trash.retentionUnit` (default 7 days).
 * Bookmarked history spines are never auto-purged (R-A10); 0 = keep forever.
 */

const DAY = 86_400_000;

function bookmark(raw: Database.Database, spineId: string): void {
	raw
		.prepare(
			"INSERT INTO bookmarks (id, content_item_id, created_at) VALUES (?, ?, ?)",
		)
		.run(randomUUID(), spineId, Date.now());
}

function makeServices(db: TestDb) {
	const archive = new ArchiveService(db.service);
	const history = new HistoryService(db.service);
	const trash = new TrashService(db.service, archive, history);
	return { archive, history, trash };
}

describe("trash: retention sweep (v1.7.0)", () => {
	it("purges only entries older than the retention window (default 7 days)", async () => {
		const db = createTestDb();
		try {
			const { history, trash } = makeServices(db);
			const raw = db.service.rawDb;

			const old = history.recordSearch({
				query: "old query",
				mode: "keyword",
				result: { items: [] },
			})!;
			const fresh = history.recordSearch({
				query: "fresh query",
				mode: "keyword",
				result: { items: [] },
			})!;
			history.deleteSearch([old.id, fresh.id]);
			// Backdate only the old one beyond the window.
			raw
				.prepare("UPDATE search_history SET deleted_at = ? WHERE id = ?")
				.run(Date.now() - 10 * DAY, old.id);

			trash.run();

			// Old purged, fresh kept.
			expect(trash.list().items.map((i) => i.id)).toEqual([fresh.id]);
			expect(orphanSpines(raw)).toBe(0);
		} finally {
			db.close();
		}
	});

	it("never auto-purges bookmarked history spines (R-A10)", async () => {
		const db = createTestDb();
		try {
			const { history, trash } = makeServices(db);
			const raw = db.service.rawDb;

			const entry = history.recordBrief({
				period: "week",
				periodStart: new Date(),
				periodEnd: new Date(),
				result: { storyCount: 1 } as never,
			})!;
			history.deleteBrief([entry.id]);
			raw
				.prepare("UPDATE brief_history SET deleted_at = ? WHERE id = ?")
				.run(Date.now() - 30 * DAY, entry.id);
			const spineId = (
				raw
					.prepare("SELECT content_item_id FROM brief_history WHERE id = ?")
					.get(entry.id) as { content_item_id: string }
			).content_item_id;
			bookmark(raw, spineId);

			trash.run();

			// The bookmarked (saved) entry survives the sweep.
			expect(trash.list().items).toHaveLength(1);
			expect(badBookmarks(raw)).toBe(0);
		} finally {
			db.close();
		}
	});

	it("purges expired trashed collections — items just move to uncategorized", async () => {
		const db = createTestDb();
		try {
			const { archive, trash } = makeServices(db);
			const raw = db.service.rawDb;

			const cat = await archive.createCollection({
				name: "Old Category",
				kind: "category",
			});
			await archive.deleteCollection(cat.id);
			raw
				.prepare("UPDATE collections SET deleted_at = ? WHERE id = ?")
				.run(Date.now() - 30 * DAY, cat.id);

			trash.run();

			expect(trash.list().items).toHaveLength(0);
			expect((await archive.listCollections()).items).toHaveLength(0);
		} finally {
			db.close();
		}
	});

	it("retention value 0 means keep everything until the user empties the trash", async () => {
		const db = createTestDb();
		try {
			const { history, trash } = makeServices(db);
			const raw = db.service.rawDb;
			history.setSetting("trash.retentionValue", 0);

			const entry = history.recordSearch({
				query: "kept forever",
				mode: "keyword",
				result: { items: [] },
			})!;
			history.deleteSearch([entry.id]);
			raw
				.prepare("UPDATE search_history SET deleted_at = ? WHERE id = ?")
				.run(Date.now() - 100 * DAY, entry.id);

			trash.run();
			expect(trash.list().items).toHaveLength(1);
		} finally {
			db.close();
		}
	});
});

function orphanSpines(raw: Database.Database): number {
	return (
		raw
			.prepare(
				`SELECT COUNT(*) AS c FROM content_items ci
				 LEFT JOIN articles a ON a.content_item_id = ci.id
				 LEFT JOIN search_history s ON s.content_item_id = ci.id
				 LEFT JOIN brief_history b ON b.content_item_id = ci.id
				 LEFT JOIN generated_history g ON g.content_item_id = ci.id
				 WHERE a.id IS NULL AND s.id IS NULL AND b.id IS NULL AND g.id IS NULL`,
			)
			.get() as { c: number }
	).c;
}

function badBookmarks(raw: Database.Database): number {
	return (
		raw
			.prepare(
				`SELECT COUNT(*) AS c FROM bookmarks bk
				 LEFT JOIN content_items ci ON ci.id = bk.content_item_id
				 WHERE ci.id IS NULL`,
			)
			.get() as { c: number }
	).c;
}
