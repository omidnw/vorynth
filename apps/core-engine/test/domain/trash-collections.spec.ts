import { randomUUID } from "node:crypto";
import { ArchiveService } from "../../src/modules/archive/archive.service.js";
import { HistoryService } from "../../src/modules/history/history.service.js";
import { TrashService } from "../../src/modules/trash/trash.service.js";
import { attachSpine, createSpine } from "../../src/db/spine.js";
import { createTestDb, type TestDb } from "../helpers/db.js";

/**
 * Trash — collection soft-delete semantics (v1.7.0).
 *
 * Deleting a collection soft-deletes its whole subtree: it leaves the live
 * tree but items keep their hidden folder link, so restore is exact (items
 * the user moved elsewhere stay there). Permanent purge moves items to
 * uncategorized — content is never touched (R-A11).
 */

function seedSource(db: TestDb, id = "src-test"): void {
	db.service.rawDb
		.prepare(
			`INSERT INTO sources (id, name, url, type, category, adapter)
			 VALUES (?, 'Test Source', 'https://example.com', 'rss', 'other', 'rss')`,
		)
		.run(id);
}

function seedArticle(
	db: TestDb,
	sourceId: string,
): { articleId: string; spineId: string } {
	const raw = db.service.rawDb;
	const articleId = randomUUID();
	const spineId = createSpine(raw, "article");
	raw.prepare(
		`INSERT INTO articles (id, source_id, title, content, url, hash, published_at, collected_at)
		 VALUES (?, ?, 'Test story', 'body', 'https://example.com/a', ?, ?, ?)`,
	).run(articleId, sourceId, randomUUID(), Date.now(), Date.now());
	attachSpine(raw, "articles", articleId, spineId);
	return { articleId, spineId };
}

function makeServices(db: TestDb) {
	const archive = new ArchiveService(db.service);
	const history = new HistoryService(db.service);
	const trash = new TrashService(db.service, archive, history);
	return { archive, history, trash };
}

describe("trash: collections (v1.7.0)", () => {
	it("soft-deletes the whole subtree and hides it from the live tree", async () => {
		const db = createTestDb();
		try {
			const { archive, trash } = makeServices(db);
			const cat = await archive.createCollection({
				name: "Research",
				kind: "category",
			});
			const folder = await archive.createCollection({
				name: "Papers",
				kind: "folder",
				parentId: cat.id,
			});
			await archive.createCollection({
				name: "Sub-topic",
				kind: "folder",
				parentId: folder.id,
			});

			await archive.deleteCollection(cat.id);

			// The whole subtree is trashed: nothing appears in the live tree.
			expect((await archive.listCollections()).items).toHaveLength(0);
			// The unified trash lists exactly one root entry (the category).
			const trashList = trash.list();
			expect(trashList.items).toHaveLength(1);
			expect(trashList.items[0]).toMatchObject({
				kind: "collection",
				id: cat.id,
				name: "Research",
			});
			// Sub-folder count included in the subtitle.
			expect(trashList.items[0].subtitle).toContain("2 sub-folders");

			// Items keep their hidden folder links (rows are not deleted).
			const rows = db.service.rawDb
				.prepare("SELECT id, deleted_at FROM collections")
				.all() as Array<{ id: string; deleted_at: number | null }>;
			expect(rows.every((r) => r.deleted_at !== null)).toBe(true);
		} finally {
			db.close();
		}
	});

	it("restore returns the subtree; items the user moved elsewhere stay put", async () => {
		const db = createTestDb();
		try {
			seedSource(db);
			const { archive, trash } = makeServices(db);
			const cat = await archive.createCollection({
				name: "Research",
				kind: "category",
			});
			const folder = await archive.createCollection({
				name: "Papers",
				kind: "folder",
				parentId: cat.id,
			});
			const other = await archive.createCollection({
				name: "Other",
				kind: "category",
			});
			const itemA = seedArticle(db, "src-test").spineId;
			const itemB = seedArticle(db, "src-test").spineId;
			await archive.updateItem(itemA, { collectionId: folder.id });
			await archive.updateItem(itemB, { collectionId: cat.id });

			await archive.deleteCollection(cat.id);
			// While trashed, the user files itemA elsewhere.
			await archive.updateItem(itemA, { collectionId: other.id });

			await trash.restore({ kind: "collection", id: cat.id });

			// Subtree is back in the live tree.
			const live = await archive.listCollections();
			expect(live.items.map((c) => c.id)).toEqual(
				expect.arrayContaining([cat.id, folder.id]),
			);
			// itemB (never moved) came back with the folder; itemA (moved
			// elsewhere) kept its new home.
			const raw = db.service.rawDb;
			const get = (id: string) =>
				(raw.prepare("SELECT collection_id FROM content_items WHERE id = ?").get(id) as { collection_id: string | null }).collection_id;
			expect(get(itemA)).toBe(other.id);
			expect(get(itemB)).toBe(cat.id);
		} finally {
			db.close();
		}
	});

	it("restore is refused with 409 when a live sibling took the name", async () => {
		const db = createTestDb();
		try {
			const { archive, trash } = makeServices(db);
			const cat = await archive.createCollection({
				name: "Work",
				kind: "category",
			});
			await archive.deleteCollection(cat.id);

			// The trashed collection no longer holds the name.
			await archive.createCollection({ name: "Work", kind: "category" });

			const err = await trash
				.restore({ kind: "collection", id: cat.id })
				.catch((e) => e);
			expect(err.getStatus()).toBe(409);
			expect(err.getResponse().code).toBe("COLLECTION_NAME_CONFLICT");
		} finally {
			db.close();
		}
	});

	it("purge permanently removes the subtree and moves items to uncategorized", async () => {
		const db = createTestDb();
		try {
			seedSource(db);
			const { archive, trash } = makeServices(db);
			const cat = await archive.createCollection({
				name: "Research",
				kind: "category",
			});
			const { spineId } = seedArticle(db, "src-test");
			await archive.updateItem(spineId, { collectionId: cat.id });

			await archive.deleteCollection(cat.id);
			expect(trash.list().items).toHaveLength(1);

			const removed = await trash.purge({ kind: "collection", id: cat.id });
			expect(removed).toBeGreaterThanOrEqual(1);

			// Collection rows gone; the item survived as uncategorized.
			expect((await archive.listCollections()).items).toHaveLength(0);
			expect(trash.list().items).toHaveLength(0);
			const raw = db.service.rawDb;
			const item = raw
				.prepare("SELECT collection_id FROM content_items WHERE id = ?")
				.get(spineId) as { collection_id: string | null };
			expect(item.collection_id).toBeNull();
			expect(
				(raw.prepare("SELECT COUNT(*) AS c FROM content_items WHERE id = ?").get(spineId) as { c: number }).c,
			).toBe(1);
		} finally {
			db.close();
		}
	});

	it("trashed collections cannot be renamed, moved into, or used as parents", async () => {
		const db = createTestDb();
		try {
			const { archive } = makeServices(db);
			const cat = await archive.createCollection({
				name: "Research",
				kind: "category",
			});
			await archive.deleteCollection(cat.id);

			// Rename a trashed collection → 404.
			await expect(
				archive.updateCollection(cat.id, { name: "Renamed" }),
			).rejects.toThrow();
			// A trashed collection can't be a move target.
			await expect(
				archive.updateCollection(cat.id, { parentId: null }),
			).rejects.toThrow();
			// ...or a parent for a new collection.
			await expect(
				archive.createCollection({
					name: "under trashed",
					kind: "folder",
					parentId: cat.id,
				}),
			).rejects.toThrow();
		} finally {
			db.close();
		}
	});
});
