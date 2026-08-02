import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { ArchiveService } from "../../src/modules/archive/archive.service.js";
import { HistoryService } from "../../src/modules/history/history.service.js";
import { TrashService } from "../../src/modules/trash/trash.service.js";
import { createTestDb, type TestDb } from "../helpers/db.js";

/**
 * Trash — history entry soft-delete semantics (v1.7.0).
 *
 * Deleting a history entry (search / brief / generated) soft-deletes it: it
 * leaves the drawer but keeps its archive spine, so nothing is orphaned while
 * trashed. Restore brings it back. Permanent purge removes origin + spine
 * together; a bookmarked spine refuses purge without `force` (R-A10).
 */

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

function bookmark(raw: Database.Database, spineId: string): void {
	raw.prepare(
		"INSERT INTO bookmarks (id, content_item_id, created_at) VALUES (?, ?, ?)",
	).run(randomUUID(), spineId, Date.now());
}

function makeServices(db: TestDb) {
	const archive = new ArchiveService(db.service);
	const history = new HistoryService(db.service);
	const trash = new TrashService(db.service, archive, history);
	return { archive, history, trash };
}

describe("trash: history entries (v1.7.0)", () => {
	it("deleting a search is soft — hidden from the drawer, spine intact, restorable", async () => {
		const db = createTestDb();
		try {
			const { history, trash, archive } = makeServices(db);
			const entry = history.recordSearch({
				query: "langgraph agents",
				mode: "keyword",
				result: { items: [] },
			})!;

			history.deleteSearch([entry.id]);

			// Hidden from the live list, still in the trash.
			expect(history.listSearch().items).toHaveLength(0);
			expect(trash.list().items).toHaveLength(1);
			expect(trash.list().items[0]).toMatchObject({
				kind: "search",
				id: entry.id,
				name: "langgraph agents",
			});
			// The spine survives while trashed — no orphan, archive item intact.
			expect(orphanSpines(db.service.rawDb)).toBe(0);
			expect((await archive.listItems({})).items).toHaveLength(1);

			await trash.restore({ kind: "search", id: entry.id });
			expect(history.listSearch().items).toHaveLength(1);
			expect(trash.list().items).toHaveLength(0);
		} finally {
			db.close();
		}
	});

	it("purge removes origin + spine together — no orphans, no phantom archive items", async () => {
		const db = createTestDb();
		try {
			const { history, trash, archive } = makeServices(db);
			const entry = history.recordSearch({
				query: "llm security",
				mode: "ai",
				result: { answer: "…", citations: [], hits: [], tokensUsed: 10 },
			})!;
			history.deleteSearch([entry.id]);

			const removed = await trash.purge({ kind: "search", id: entry.id });
			expect(removed).toBe(1);

			expect(history.listSearch().items).toHaveLength(0);
			expect(trash.list().items).toHaveLength(0);
			expect(orphanSpines(db.service.rawDb)).toBe(0);
			expect((await archive.listItems({})).items).toHaveLength(0);
		} finally {
			db.close();
		}
	});

	it("purge of a bookmarked entry is refused without force; force removes the bookmark too", async () => {
		const db = createTestDb();
		try {
			const { history, trash } = makeServices(db);
			const entry = history.recordGenerated({
				kind: "behavior-summary",
				title: "Your behavior",
				result: "…",
				tokensUsed: 5,
			})!;
			history.deleteGenerated([entry.id]);
			const raw = db.service.rawDb;
			const spineId = (
				raw.prepare("SELECT content_item_id FROM generated_history WHERE id = ?").get(entry.id) as { content_item_id: string }
			).content_item_id;
			bookmark(raw, spineId);

			// Without force → 409 BOOKMARKED_ITEMS_EXIST.
			const err = await trash
				.purge({ kind: "generated", id: entry.id })
				.catch((e) => e);
			expect(err.getStatus()).toBe(409);
			expect(err.getResponse().code).toBe("BOOKMARKED_ITEMS_EXIST");
			expect(err.getResponse().count).toBe(1);

			// With force → origin, spine and bookmark all gone, no orphans.
			await trash.purge({ kind: "generated", id: entry.id, force: true });
			expect(orphanSpines(raw)).toBe(0);
			expect(badBookmarks(raw)).toBe(0);
		} finally {
			db.close();
		}
	});

	it("empty trash refuses when saved items are inside, then clears everything with force", async () => {
		const db = createTestDb();
		try {
			const { history, trash } = makeServices(db);
			const search = history.recordSearch({
				query: "rust async",
				mode: "keyword",
				result: { items: [] },
			})!;
			const brief = history.recordBrief({
				period: "today",
				periodStart: new Date(),
				periodEnd: new Date(),
				result: { storyCount: 2 } as never,
			})!;
			history.deleteSearch([search.id]);
			history.deleteBrief([brief.id]);
			const raw = db.service.rawDb;
			const spineId = (
				raw.prepare("SELECT content_item_id FROM brief_history WHERE id = ?").get(brief.id) as { content_item_id: string }
			).content_item_id;
			bookmark(raw, spineId);

			let err: unknown;
			try {
				trash.empty(false);
			} catch (e) {
				err = e;
			}
			expect((err as { getStatus(): number }).getStatus()).toBe(409);
			expect(
				(err as { getResponse(): { code: string } }).getResponse().code,
			).toBe("BOOKMARKED_ITEMS_EXIST");

			const removed = trash.empty(true);
			expect(removed).toBeGreaterThanOrEqual(2);
			expect(trash.list().items).toHaveLength(0);
			expect(orphanSpines(raw)).toBe(0);
			expect(badBookmarks(raw)).toBe(0);
		} finally {
			db.close();
		}
	});
});
