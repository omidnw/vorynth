import { mkdtempSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestDb, type TestDb } from "../helpers/db.js";
import { MediaService } from "../../src/modules/media/media.service.js";

/**
 * Media storage dashboard + download endpoints (v1.8.0).
 *
 * `localSummary()` must return every locally-kept item with the metadata the
 * Media page needs for a download (kind, mime, bytes, caption, keptAt) plus the
 * article title/URL/source for the copyright attribution credit. `getLocalFile()`
 * resolves a kept item's on-disk bytes and returns null when the item was never
 * kept, doesn't exist, or its file has vanished.
 */

describe("MediaService local storage", () => {
	let tdb: TestDb;
	let mediaDir: string;

	beforeEach(() => {
		tdb = createTestDb();
		mediaDir = mkdtempSync(join(tmpdir(), "vorynth-media-test-"));
		tdb.service.rawDb
			.prepare(
				`INSERT INTO sources (id, name, url, type, category, adapter)
				 VALUES ('src-m', 'Media Test Blog', 'https://blog.example.com', 'rss', 'other', 'rss')`,
			)
			.run();
		tdb.service.rawDb
			.prepare(
				`INSERT INTO articles (id, source_id, title, content, url, hash, published_at, collected_at)
				 VALUES ('art-m', 'src-m', 'The Media Article', 'Body text', 'https://blog.example.com/posts/1', 'h1', ?, ?)`,
			)
			.run(Date.now(), Date.now());
	});

	afterEach(() => {
		tdb.close();
	});

	function seedMediaRow(opts: {
		id: string;
		kind: "image" | "video";
		localPath: string | null;
		keptAt: number | null;
		bytes?: number | null;
		mime?: string | null;
		caption?: string | null;
		url?: string;
	}) {
		tdb.service.rawDb
			.prepare(
				`INSERT INTO article_media (id, article_id, url, kind, local_path, bytes, mime, caption, kept_at, fetched_at, updated_at)
				 VALUES (?, 'art-m', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			)
			.run(
				opts.id,
				opts.url ?? `https://blog.example.com/${opts.id}.jpg`,
				opts.kind,
				opts.localPath,
				opts.bytes ?? null,
				opts.mime ?? null,
				opts.caption ?? null,
				opts.keptAt,
				Date.now(),
				Date.now(),
			);
	}

	it("localSummary returns per-article items with attribution fields", async () => {
		const keptPath = join(mediaDir, "kept.png");
		await writeFile(keptPath, "bytes");
		seedMediaRow({
			id: "m1",
			kind: "image",
			localPath: keptPath,
			keptAt: Date.now(),
			bytes: 5,
			mime: "image/png",
			caption: "A chart",
		});
		// A remote (never-kept) row must not appear in the dashboard.
		seedMediaRow({ id: "m2", kind: "image", localPath: null, keptAt: null });

		const svc = new MediaService(tdb.service);
		const summary = await svc.localSummary();

		expect(summary.totalItems).toBe(1);
		expect(summary.articles).toHaveLength(1);
		const a = summary.articles[0]!;
		expect(a).toMatchObject({
			articleId: "art-m",
			articleTitle: "The Media Article",
			// No translation happened → the title IS the original.
			articleOriginalTitle: null,
			articleUrl: "https://blog.example.com/posts/1",
			sourceName: "Media Test Blog",
			itemCount: 1,
			bytes: 5,
		});
		expect(a.items).toHaveLength(1);
		expect(a.items[0]).toMatchObject({
			id: "m1",
			kind: "image",
			url: "https://blog.example.com/m1.jpg",
			mime: "image/png",
			bytes: 5,
			caption: "A chart",
		});
		// keptAt is serialized to ISO for the dashboard.
		expect(typeof a.items[0]!.keptAt).toBe("string");
	});

	it("localSummary exposes the ORIGINAL title of a translated story for attribution", async () => {
		// A translated story: title holds the translation, original_title the true
		// published title (as translateStory / the batch job write it).
		tdb.service.rawDb
			.prepare("UPDATE articles SET title = ?, original_title = ? WHERE id = ?")
			.run("عنوان ترجمه شده", "Original Published Title", "art-m");

		const keptPath = join(mediaDir, "kept.png");
		await writeFile(keptPath, "bytes");
		seedMediaRow({
			id: "m1",
			kind: "image",
			localPath: keptPath,
			keptAt: Date.now(),
			bytes: 5,
			mime: "image/png",
		});

		const svc = new MediaService(tdb.service);
		const summary = await svc.localSummary();

		const a = summary.articles[0]!;
		expect(a.articleTitle).toBe("عنوان ترجمه شده");
		// The desktop uses `articleOriginalTitle ?? articleTitle` for the credit.
		expect(a.articleOriginalTitle).toBe("Original Published Title");
	});

	it("getLocalFile resolves a kept item's on-disk file", async () => {
		const keptPath = join(mediaDir, "kept.png");
		await writeFile(keptPath, "image-bytes");
		seedMediaRow({
			id: "m1",
			kind: "image",
			localPath: keptPath,
			keptAt: Date.now(),
			bytes: 11,
			mime: "image/png",
		});

		const svc = new MediaService(tdb.service);
		const file = await svc.getLocalFile("m1");
		expect(file).not.toBeNull();
		expect(file?.path).toBe(keptPath);
		expect(file?.mime).toBe("image/png");
		expect(file?.bytes).toBe(11);
	});

	it("getLocalFile returns null for a remote (never-kept) item", async () => {
		seedMediaRow({ id: "m1", kind: "image", localPath: null, keptAt: null });

		const svc = new MediaService(tdb.service);
		await expect(svc.getLocalFile("m1")).resolves.toBeNull();
	});

	it("getLocalFile returns null for a missing item or a vanished file", async () => {
		const svc = new MediaService(tdb.service);
		await expect(svc.getLocalFile("nope")).resolves.toBeNull();

		// Row claims a file that no longer exists on disk (stale row).
		seedMediaRow({
			id: "m1",
			kind: "image",
			localPath: join(mediaDir, "gone.png"),
			keptAt: Date.now(),
		});
		await expect(svc.getLocalFile("m1")).resolves.toBeNull();
	});
});
