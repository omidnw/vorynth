import { randomUUID } from "node:crypto";
import { RetentionService } from "../../src/modules/retention/retention.service.js";
import { HistoryService } from "../../src/modules/history/history.service.js";
import { createTestDb, type TestDb } from "../helpers/db.js";
import { attachSpine, createSpine } from "../../src/db/spine.js";

/**
 * Auto-delete retention (v1.6.0) — a global "delete old stories" policy.
 *
 * Business rules:
 *   • stories older than `retention.autoDeleteDays` are removed (0 = off);
 *   • bookmarked stories are protected by default (R-A10);
 *   • stories placed in a collection are protected by default;
 *   • deleting stories must not leave orphan spines or dangling bookmarks.
 */
describe("auto-delete retention", () => {
	function seed(db: TestDb): {
		old: string;
		oldBookmarked: string;
		oldInCollection: string;
		fresh: string;
	} {
		const raw = db.service.rawDb;
		raw.prepare(
			`INSERT INTO sources (id, name, url, type, category, adapter)
			 VALUES ('src-ret', 'Ret', 'https://e.com', 'rss', 'other', 'rss')`,
		).run();
		const old = randomUUID();
		const oldBookmarked = randomUUID();
		const oldInCollection = randomUUID();
		const fresh = randomUUID();
		const oldTs = Date.now() - 60 * 86_400_000; // 60 days ago
		const now = Date.now();

		const insert = (id: string, at: number) => {
			const spine = createSpine(raw, "article", new Date(at));
			raw.prepare(
				`INSERT INTO articles (id, source_id, title, content, url, hash, collected_at)
				 VALUES (?, 'src-ret', 't', 'c', 'u', ?, ?)`,
			).run(id, randomUUID(), at);
			attachSpine(raw, "articles", id, spine);
			return spine;
		};
		const sOld = insert(old, oldTs);
		const sOldBookmarked = insert(oldBookmarked, oldTs);
		const sOldInCollection = insert(oldInCollection, oldTs);
		insert(fresh, now);

		// Bookmark one old story; put another in a collection.
		raw.prepare(
			"INSERT INTO bookmarks (id, content_item_id, created_at) VALUES (?, ?, ?)",
		).run(randomUUID(), sOldBookmarked, now);
		raw.prepare(
			"INSERT INTO collections (id, name, kind) VALUES (?, ?, ?)",
		).run("col-ret", "Reading", "category");
		raw.prepare("UPDATE content_items SET collection_id = 'col-ret' WHERE id = ?").run(
			sOldInCollection,
		);
		return { old, oldBookmarked, oldInCollection, fresh };
	}

	const count = (db: TestDb, id: string) =>
		(db.service.rawDb
			.prepare("SELECT COUNT(*) AS c FROM articles WHERE id = ?")
			.get(id) as { c: number }).c;

	it("removes only unprotected old stories (bookmarks + collections protected by default)", () => {
		const db = createTestDb();
		try {
			const history = new HistoryService(db.service);
			history.setSetting("retention.autoDeleteDays", 30);
			const { old, oldBookmarked, oldInCollection, fresh } = seed(db);
			const retention = new RetentionService(db.service, history);

			expect(retention.run()).toBe(1); // only `old` is unprotected

			expect(count(db, old)).toBe(0); // removed
			expect(count(db, oldBookmarked)).toBe(1); // protected
			expect(count(db, oldInCollection)).toBe(1); // protected
			expect(count(db, fresh)).toBe(1); // not old enough
		} finally {
			db.close();
		}
	});

	it("respects turning protections off (everything old is removed)", () => {
		const db = createTestDb();
		try {
			const history = new HistoryService(db.service);
			history.setSetting("retention.autoDeleteDays", 30);
			history.setSetting("retention.protectBookmarked", false);
			history.setSetting("retention.protectInCollection", false);
			const { old, oldBookmarked, oldInCollection, fresh } = seed(db);
			const retention = new RetentionService(db.service, history);

			expect(retention.run()).toBe(3);

			expect(count(db, old)).toBe(0);
			expect(count(db, oldBookmarked)).toBe(0);
			expect(count(db, oldInCollection)).toBe(0);
			expect(count(db, fresh)).toBe(1);
		} finally {
			db.close();
		}
	});

	it("is a no-op when autoDeleteDays is off (0)", () => {
		const db = createTestDb();
		try {
			const { old } = seed(db);
			const retention = new RetentionService(
				db.service,
				new HistoryService(db.service),
			);
			expect(retention.run()).toBe(0);
			expect(count(db, old)).toBe(1);
		} finally {
			db.close();
		}
	});
});
