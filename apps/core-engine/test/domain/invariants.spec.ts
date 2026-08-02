import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { CrawlerService } from "../../src/modules/crawler/crawler.service.js";
import { SourcesService } from "../../src/modules/sources/sources.service.js";
import { ArchiveService } from "../../src/modules/archive/archive.service.js";
import { BookmarksService } from "../../src/modules/bookmarks/bookmarks.service.js";
import { ensureSpines } from "../../src/db/ddl.js";
import { attachSpine, createSpine } from "../../src/db/spine.js";
import { createTestDb, type TestDb } from "../helpers/db.js";

/**
 * Domain invariant tests — the business laws of Vorynth (R-A09/R-A10/R-A11).
 *
 * These are NOT feature tests ("POST bookmark returns 200"). They assert that
 * invalid states stay impossible:
 *   • every origin row has exactly one archive spine
 *   • a bookmark can never point at a missing item
 *   • retention never prunes bookmarked content
 *   • source force-deletion leaves no orphans
 *   • the collection tree obeys parent_type + depth
 */

// ── seeding helpers ─────────────────────────────────────────────────────────

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
	opts: { publishedAt?: number; contentItemId?: string } = {},
): { articleId: string; spineId: string } {
	const raw = db.service.rawDb;
	const articleId = randomUUID();
	const spineId = opts.contentItemId ?? createSpine(raw, "article");
	raw.prepare(
		`INSERT INTO articles (id, source_id, title, content, url, hash, published_at, collected_at)
		 VALUES (?, ?, 'Test story', 'body', 'https://example.com/a', ?, ?, ?)`,
	).run(
		articleId,
		sourceId,
		randomUUID(),
		opts.publishedAt ?? Date.now(),
		Date.now(),
	);
	attachSpine(raw, "articles", articleId, spineId);
	return { articleId, spineId };
}

function bookmark(db: TestDb, spineId: string): void {
	db.service.rawDb
		.prepare("INSERT INTO bookmarks (id, content_item_id, created_at) VALUES (?, ?, ?)")
		.run(randomUUID(), spineId, Date.now());
}

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

function originsWithoutSpine(raw: Database.Database, table: string): number {
	return (
		raw
			.prepare(`SELECT COUNT(*) AS c FROM ${table} WHERE content_item_id IS NULL`)
			.get() as { c: number }
	).c;
}

// ── tests ───────────────────────────────────────────────────────────────────

describe("domain invariants: archive spine (R-A09)", () => {
	it("ensureSpines repairs an origin without a spine", () => {
		const db = createTestDb();
		try {
			seedSource(db);
			const raw = db.service.rawDb;
			// An article inserted by pre-v1.6.0 code has no spine.
			raw.prepare(
				`INSERT INTO articles (id, source_id, title, content, url, hash, collected_at)
				 VALUES (?, 'src-test', 'legacy', 'body', 'https://e.com', 'legacy-hash', ?)`,
			).run(randomUUID(), Date.now());
			expect(originsWithoutSpine(raw, "articles")).toBeGreaterThan(0);

			// The startup repair pass links it (idempotent).
			expect(ensureSpines(raw)).toBeGreaterThan(0);
			expect(originsWithoutSpine(raw, "articles")).toBe(0);
			expect(orphanSpines(raw)).toBe(0);
		} finally {
			db.close();
		}
	});

	it("the seed DB ships with zero violations", () => {
		const db = createTestDb();
		try {
			const raw = db.service.rawDb;
			expect(originsWithoutSpine(raw, "articles")).toBe(0);
			expect(originsWithoutSpine(raw, "search_history")).toBe(0);
			expect(originsWithoutSpine(raw, "brief_history")).toBe(0);
			expect(originsWithoutSpine(raw, "generated_history")).toBe(0);
			expect(orphanSpines(raw)).toBe(0);
			expect(badBookmarks(raw)).toBe(0);
		} finally {
			db.close();
		}
	});
});

describe("domain invariants: bookmark ownership (R-A10)", () => {
	it("a bookmark can never point at a missing content item", () => {
		const db = createTestDb();
		try {
			seedSource(db);
			const { spineId } = seedArticle(db, "src-test");
			bookmark(db, spineId);
			expect(badBookmarks(db.service.rawDb)).toBe(0);

			// Deleting the bookmark flag keeps the item (and its origin).
			db.service.rawDb
				.prepare("DELETE FROM bookmarks WHERE content_item_id = ?")
				.run(spineId);
			expect(badBookmarks(db.service.rawDb)).toBe(0);
			expect(
				db.service.rawDb
					.prepare("SELECT COUNT(*) AS c FROM content_items WHERE id = ?")
					.get(spineId) as { c: number },
			).toEqual({ c: 1 });
		} finally {
			db.close();
		}
	});

	it("retention pruning never removes a bookmarked article", async () => {
		const db = createTestDb();
		try {
			seedSource(db);
			const old = Date.now() - 30 * 86_400_000; // outside a 7-day window
			const kept = seedArticle(db, "src-test", { publishedAt: old });
			const pruned = seedArticle(db, "src-test", { publishedAt: old });
			bookmark(db, kept.spineId); // only `kept` is bookmarked

			const crawler = new CrawlerService(db.service);
			await crawler.pruneOlderThan("src-test", 7);

			const raw = db.service.rawDb;
			// The bookmarked article survived; the plain one was pruned.
			expect(
				(raw.prepare("SELECT COUNT(*) AS c FROM articles WHERE id = ?").get(kept.articleId) as { c: number }).c,
			).toBe(1);
			expect(
				(raw.prepare("SELECT COUNT(*) AS c FROM articles WHERE id = ?").get(pruned.articleId) as { c: number }).c,
			).toBe(0);
			expect(badBookmarks(raw)).toBe(0);
		} finally {
			db.close();
		}
	});

	it("source deletion is refused without force when bookmarked articles exist", async () => {
		const db = createTestDb();
		try {
			seedSource(db);
			seedArticle(db, "src-test");
			const { spineId } = seedArticle(db, "src-test");
			bookmark(db, spineId);

			const sources = new SourcesService(db.service);
			const err = await sources.remove("src-test", false).catch((e) => e);
			expect(err.getStatus()).toBe(409);
			expect(err.getResponse().code).toBe("BOOKMARKED_ARTICLES_EXIST");
			expect(err.getResponse().bookmarkedCount).toBe(1);
		} finally {
			db.close();
		}
	});

	it("force source deletion removes articles, spines and bookmarks — no orphans", async () => {
		const db = createTestDb();
		try {
			seedSource(db);
			seedArticle(db, "src-test");
			const { spineId } = seedArticle(db, "src-test");
			bookmark(db, spineId);

			const sources = new SourcesService(db.service);
			await sources.remove("src-test", true);

			const raw = db.service.rawDb;
			expect(
				(raw.prepare("SELECT COUNT(*) AS c FROM articles WHERE source_id = 'src-test'").get() as { c: number }).c,
			).toBe(0);
			expect(orphanSpines(raw)).toBe(0);
			expect(badBookmarks(raw)).toBe(0);
		} finally {
			db.close();
		}
	});
});

describe("domain invariants: collection tree (R-A11)", () => {
	it("categories are roots; folders nest under them; depth capped at 3", async () => {
		const db = createTestDb();
		try {
			const archive = new ArchiveService(db.service);

			const cat = await archive.createCollection({
				name: "AI Research",
				kind: "category",
			});
			// A bare folder has nowhere to live.
			await expect(
				archive.createCollection({ name: "orphan", kind: "folder" }),
			).rejects.toThrow();
			// Categories don't nest under categories.
			await expect(
				archive.createCollection({
					name: "nested cat",
					kind: "category",
					parentId: cat.id,
				}),
			).rejects.toThrow();

			const folder = await archive.createCollection({
				name: "LLM Papers",
				kind: "folder",
				parentId: cat.id,
			});
			// Depth 3 is fine…
			const deep = await archive.createCollection({
				name: "Sub-topic",
				kind: "folder",
				parentId: folder.id,
			});
			// …depth 4 exceeds MAX_COLLECTION_DEPTH.
			await expect(
				archive.createCollection({
					name: "too deep",
					kind: "folder",
					parentId: deep.id,
				}),
			).rejects.toThrow();
		} finally {
			db.close();
		}
	});

	it("soft-deleting a collection keeps items linked; purging moves them to uncategorized", async () => {
		const db = createTestDb();
		try {
			seedSource(db);
			const archive = new ArchiveService(db.service);
			const cat = await archive.createCollection({
				name: "Research",
				kind: "category",
			});
			const { spineId } = seedArticle(db, "src-test");

			await archive.updateItem(spineId, { collectionId: cat.id });

			// v1.7.0 — delete is a soft delete: the item keeps its hidden folder
			// link (that is what makes restore exact), the collection leaves the
			// live tree, and the item still exists.
			await archive.deleteCollection(cat.id);
			const raw = db.service.rawDb;
			const item = raw
				.prepare("SELECT collection_id FROM content_items WHERE id = ?")
				.get(spineId) as { collection_id: string | null };
			expect(item.collection_id).toBe(cat.id);
			expect((await archive.listCollections()).items).toHaveLength(0);

			// Permanently purging the trashed collection moves items to
			// uncategorized — never deletes content (R-A11).
			await archive.purgeCollection(cat.id);
			const afterPurge = raw
				.prepare("SELECT collection_id FROM content_items WHERE id = ?")
				.get(spineId) as { collection_id: string | null };
			expect(afterPurge.collection_id).toBeNull();
			expect(
				(raw.prepare("SELECT COUNT(*) AS c FROM content_items WHERE id = ?").get(spineId) as { c: number }).c,
			).toBe(1);
		} finally {
			db.close();
		}
	});
});

describe("archive + bookmarks services", () => {
	it("bookmarks a content item, dedups with 409, and lists saved items", async () => {
		const db = createTestDb();
		try {
			seedSource(db);
			const { spineId } = seedArticle(db, "src-test");
			const bookmarks = new BookmarksService(db.service, new ArchiveService(db.service));

			const saved = await bookmarks.create(spineId);
			expect(saved.bookmarked).toBe(true);
			expect(saved.contentItemId).toBe(spineId);

			// Duplicate bookmark → 409 BOOKMARK_ALREADY_EXISTS.
			const err = await bookmarks.create(spineId).catch((e) => e);
			expect(err.getStatus()).toBe(409);
			expect(err.getResponse().code).toBe("BOOKMARK_ALREADY_EXISTS");

			// Missing item → 404 CONTENT_ITEM_NOT_FOUND.
			const missing = await bookmarks.create("nope").catch((e) => e);
			expect(missing.getStatus()).toBe(404);
			expect(missing.getResponse().code).toBe("CONTENT_ITEM_NOT_FOUND");

			const list = await bookmarks.list();
			expect(list.items).toHaveLength(1);
			expect(list.items[0].title).toBe("Test story");

			// Unsave removes only the flag.
			await bookmarks.remove(spineId);
			expect((await bookmarks.list()).items).toHaveLength(0);
		} finally {
			db.close();
		}
	});

	it("updates note, tags, collection, and archived flag on an item", async () => {
		const db = createTestDb();
		try {
			seedSource(db);
			const archive = new ArchiveService(db.service);
			const { spineId } = seedArticle(db, "src-test");
			const cat = await archive.createCollection({
				name: "Reading",
				kind: "category",
			});

			const updated = await archive.updateItem(spineId, {
				note: "must revisit",
				tags: ["llm", "security"],
				collectionId: cat.id,
				archived: true,
			});
			expect(updated.note).toBe("must revisit");
			expect(updated.tags).toEqual(expect.arrayContaining(["llm", "security"]));
			expect(updated.collectionId).toBe(cat.id);
			expect(updated.archivedAt).not.toBeNull();

			// Archived items are hidden by default — the list is empty without
			// explicitly opting in.
			expect((await archive.listItems({ q: "revisit" })).items).toHaveLength(0);

			// With archived=true, the search finds it by note / tag.
			const byNote = await archive.listItems({ q: "revisit", archived: true });
			expect(byNote.items[0].contentItemId).toBe(spineId);
			const byTag = await archive.listItems({ tag: "security", archived: true });
			expect(byTag.items[0].contentItemId).toBe(spineId);
		} finally {
			db.close();
		}
	});

	it("selecting a collection lists items in its whole subtree", async () => {
		const db = createTestDb();
		try {
			seedSource(db);
			const archive = new ArchiveService(db.service);
			const cat = await archive.createCollection({
				name: "Research",
				kind: "category",
			});
			const folder = await archive.createCollection({
				name: "Papers",
				kind: "folder",
				parentId: cat.id,
			});

			// One item directly in the category, one in a descendant folder.
			const inCategory = await archive.updateItem(
				seedArticle(db, "src-test").spineId,
				{ collectionId: cat.id },
			);
			const inFolder = await archive.updateItem(
				seedArticle(db, "src-test").spineId,
				{ collectionId: folder.id },
			);

			// A leaf folder lists only its own items…
			const direct = await archive.listItems({ collectionId: folder.id });
			expect(direct.items.map((i) => i.contentItemId)).toEqual([
				inFolder.contentItemId,
			]);

			// …while a category includes everything in its subtree (items live at
			// leaves, R-A11 — selecting a root must not appear empty).
			const subtree = await archive.listItems({ collectionId: cat.id });
			expect(subtree.items.map((i) => i.contentItemId)).toEqual(
				expect.arrayContaining([inCategory.contentItemId, inFolder.contentItemId]),
			);
			expect(subtree.items).toHaveLength(2);
		} finally {
			db.close();
		}
	});

	it("direct mode lists only the collection's own items (Explorer view)", async () => {
		const db = createTestDb();
		try {
			seedSource(db);
			const archive = new ArchiveService(db.service);
			const cat = await archive.createCollection({
				name: "Research",
				kind: "category",
			});
			const folder = await archive.createCollection({
				name: "Papers",
				kind: "folder",
				parentId: cat.id,
			});

			const inCategory = await archive.updateItem(
				seedArticle(db, "src-test").spineId,
				{ collectionId: cat.id },
			);
			const inFolder = await archive.updateItem(
				seedArticle(db, "src-test").spineId,
				{ collectionId: folder.id },
			);

			// Direct mode: the category lists ONLY its own item — the folder's
			// item belongs to the folder, not the parent.
			const direct = await archive.listItems({
				collectionId: cat.id,
				direct: true,
			});
			expect(direct.items.map((i) => i.contentItemId)).toEqual([
				inCategory.contentItemId,
			]);
			// The folder still lists its own item.
			const folderDirect = await archive.listItems({
				collectionId: folder.id,
				direct: true,
			});
			expect(folderDirect.items.map((i) => i.contentItemId)).toEqual([
				inFolder.contentItemId,
			]);
		} finally {
			db.close();
		}
	});
});
