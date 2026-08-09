import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { UsageService } from "../../src/modules/usage/usage.service.js";
import { DatabaseService } from "../../src/db/database.service.js";
import { attachSpine, createSpine } from "../../src/db/spine.js";
import { resolveMediaDir, resolveDbPath } from "../../src/db/paths.js";

/**
 * Storage + resource usage (v1.8.0) — Settings "Storage & Usage".
 *
 * Business rules:
 *   • the snapshot reports on-disk truth per library (database / media /
 *     backups / plugins) plus a total;
 *   • stories are counted by row and approximate content bytes;
 *   • "clear all stories" removes every article EXCEPT bookmarked ones and
 *     ones inside a collection (R-A10), then sweeps orphan spines (R-A09);
 *   • the CPU sample window is injectable so tests stay fast.
 */
describe("usage service", () => {
	/** Temp DB at the canonical name + UsageService pinned to that dir. */
	function makeHarness(): {
		db: DatabaseService;
		usage: UsageService;
		dir: string;
		close(): void;
	} {
		const dir = mkdtempSync(join(tmpdir(), "vorynth-usage-"));
		const db = new DatabaseService(join(dir, "vorynth.sqlite"));
		db.onModuleInit();
		const usage = new UsageService(db, dir);
		return { db, usage, dir, close: () => db.close() };
	}

	function seedSource(raw: Database.Database) {
		raw
			.prepare(
				`INSERT INTO sources (id, name, url, type, category, adapter)
			 VALUES ('src-usage', 'Usage', 'https://e.com', 'rss', 'other', 'rss')`,
			)
			.run();
	}

	function insertArticle(
		raw: Database.Database,
		id: string,
		content: string,
	): string {
		const spine = createSpine(raw, "article", new Date());
		raw
			.prepare(
				`INSERT INTO articles (id, source_id, title, content, url, hash, collected_at)
			 VALUES (?, 'src-usage', 'Title', ?, 'u', ?, ?)`,
			)
			.run(id, content, randomUUID(), Date.now());
		attachSpine(raw, "articles", id, spine);
		return spine;
	}

	const articleCount = (raw: Database.Database, id: string) =>
		(
			raw
				.prepare("SELECT COUNT(*) AS c FROM articles WHERE id = ?")
				.get(id) as {
				c: number;
			}
		).c;

	it("reports the four libraries, story count, and process stats", async () => {
		const h = makeHarness();
		try {
			seedSource(h.db.rawDb);
			insertArticle(h.db.rawDb, randomUUID(), "hello world ".repeat(50));
			insertArticle(h.db.rawDb, randomUUID(), "second story ".repeat(30));

			const stats = await h.usage.usage(5); // 5ms sample window
			expect(stats.dataDir).toBe(h.dir);
			expect(stats.libraries.map((l) => l.key)).toEqual([
				"database",
				"media",
				"backups",
				"plugins",
			]);

			const dbLib = stats.libraries.find((l) => l.key === "database")!;
			expect(dbLib.bytes).toBeGreaterThan(0); // sqlite file exists
			expect(stats.totalBytes).toBeGreaterThanOrEqual(dbLib.bytes);

			// Story accounting.
			expect(stats.stories.total).toBe(2);
			expect(stats.stories.contentBytes).toBeGreaterThan(0);

			// Process + system stats are populated.
			expect(stats.process.rssBytes).toBeGreaterThan(0);
			expect(stats.process.heapTotalBytes).toBeGreaterThan(0);
			expect(stats.process.cpuPercent).toBeGreaterThanOrEqual(0);
			expect(stats.process.uptimeSeconds).toBeGreaterThanOrEqual(0);
			expect(stats.process.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
			expect(stats.system.totalMemBytes).toBeGreaterThan(0);
			expect(stats.system.cpuCores).toBeGreaterThan(0);
		} finally {
			h.close();
		}
	});

	it("measures the media library on disk and counts kept items", async () => {
		const h = makeHarness();
		try {
			seedSource(h.db.rawDb);
			const articleId = randomUUID();
			insertArticle(h.db.rawDb, articleId, "media story");

			// A kept blob on disk (the honest on-disk figure).
			const blobDir = join(
				resolveMediaDir({ VORYNTH_DATA_DIR: h.dir }),
				articleId,
			);
			mkdirSync(blobDir, { recursive: true });
			const blob = Buffer.alloc(2048, 7);
			writeFileSync(join(blobDir, "abc123.bin"), blob);

			// A kept row (drives the item count).
			h.db.rawDb
				.prepare(
					`INSERT INTO article_media (id, article_id, url, kind, local_path, bytes, kept_at)
				 VALUES (?, ?, 'https://e.com/i.png', 'image', ?, ?, ?)`,
				)
				.run(
					randomUUID(),
					articleId,
					join(blobDir, "abc123.bin"),
					blob.length,
					Date.now(),
				);

			const stats = await h.usage.usage(1);
			const media = stats.libraries.find((l) => l.key === "media")!;
			expect(media.bytes).toBe(2048);
			expect(media.items).toBe(1);
		} finally {
			h.close();
		}
	});

	it("clearStories removes unprotected stories but keeps bookmarks + collections", () => {
		const h = makeHarness();
		try {
			seedSource(h.db.rawDb);
			const plain = randomUUID();
			const bookmarked = randomUUID();
			const inCollection = randomUUID();

			insertArticle(h.db.rawDb, plain, "plain ".repeat(100));
			const spineBookmarked = insertArticle(
				h.db.rawDb,
				bookmarked,
				"saved ".repeat(100),
			);
			const spineInCollection = insertArticle(
				h.db.rawDb,
				inCollection,
				"collected ".repeat(100),
			);

			h.db.rawDb
				.prepare(
					"INSERT INTO bookmarks (id, content_item_id, created_at) VALUES (?, ?, ?)",
				)
				.run(randomUUID(), spineBookmarked, Date.now());
			h.db.rawDb
				.prepare("INSERT INTO collections (id, name, kind) VALUES (?, ?, ?)")
				.run("col-usage", "Reading", "category");
			h.db.rawDb
				.prepare(
					"UPDATE content_items SET collection_id = 'col-usage' WHERE id = ?",
				)
				.run(spineInCollection);

			const result = h.usage.clearStories();

			expect(result.deleted).toBe(1); // only `plain`
			expect(result.keptBookmarked).toBe(1);
			expect(result.keptInCollections).toBe(1);
			expect(result.freedContentBytes).toBeGreaterThan(0);

			expect(articleCount(h.db.rawDb, plain)).toBe(0);
			expect(articleCount(h.db.rawDb, bookmarked)).toBe(1);
			expect(articleCount(h.db.rawDb, inCollection)).toBe(1);

			// Orphan spine of the deleted article is swept (R-A09); the
			// bookmarked spine survives.
			const spines = h.db.rawDb
				.prepare("SELECT COUNT(*) AS c FROM content_items")
				.get() as { c: number };
			expect(spines.c).toBe(2);
		} finally {
			h.close();
		}
	});

	it("clearStories on an empty feed is a no-op with zero counts", () => {
		const h = makeHarness();
		try {
			const result = h.usage.clearStories();
			expect(result).toEqual({
				deleted: 0,
				keptBookmarked: 0,
				keptInCollections: 0,
				freedContentBytes: 0,
			});
		} finally {
			h.close();
		}
	});

	it("the database library includes the canonical DB file even when a WAL exists", async () => {
		const h = makeHarness();
		try {
			seedSource(h.db.rawDb);
			insertArticle(h.db.rawDb, randomUUID(), "wal story");
			// Force the WAL into existence with a write.
			h.db.rawDb
				.prepare("UPDATE sources SET name = 'Usage2' WHERE id = 'src-usage'")
				.run();

			const stats = await h.usage.usage(1);
			const dbLib = stats.libraries.find((l) => l.key === "database")!;
			expect(dbLib.bytes).toBeGreaterThan(0);
			expect(stats.totalBytes).toBeGreaterThanOrEqual(dbLib.bytes);
			// resolveDbPath used by the service resolves to the same file.
			expect(resolveDbPath({ VORYNTH_DATA_DIR: h.dir })).toBe(
				join(h.dir, "vorynth.sqlite"),
			);
		} finally {
			h.close();
		}
	});
});
