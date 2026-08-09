import { ServiceUnavailableException } from "@nestjs/common";
import { createTestDb, type TestDb } from "../helpers/db.js";
import { seedSourceLists } from "../../src/db/ddl.js";
import { CrawlerService } from "../../src/modules/crawler/crawler.service.js";
import { PluginsService } from "../../src/modules/plugins/plugins.service.js";
import { ConnectorRegistryService } from "../../src/modules/connector-registry/connector-registry.service.js";
import {
	SourceListsService,
	type CatalogFetcher,
} from "../../src/modules/sources/source-lists.service.js";

/**
 * Source lists (v1.8.0) — seeding/backfill, the enable/disable lifecycle, the
 * offline community catalog refresh (injected fetcher, fully offline), and the
 * crawler's list.enabled gate.
 *
 * Community data is treated as untrusted (R-A06): the tests prove invalid
 * entries are skipped, never stored.
 */

function makePlugins(db: TestDb): PluginsService {
	return new PluginsService(
		db.service,
		new ConnectorRegistryService(db.service),
	);
}

function makeLists(db: TestDb, fetcher?: CatalogFetcher): SourceListsService {
	return new SourceListsService(db.service, makePlugins(db), fetcher);
}

function makeCrawler(db: TestDb): CrawlerService {
	const plugins = makePlugins(db);
	plugins.onModuleInit();
	const crawler = new CrawlerService(db.service, plugins, makeLists(db));
	crawler.onModuleInit();
	return crawler;
}

describe("source lists: seeding + backfill (v1.8.0)", () => {
	it("seeds the official developer list and assigns every seed source to it", () => {
		const db = createTestDb();
		try {
			const lists = db.service.rawDb
				.prepare("SELECT * FROM source_lists")
				.all() as Array<{
				id: string;
				origin: string;
				enabled: number;
				nsfw: number;
			}>;
			expect(lists).toHaveLength(1);
			expect(lists[0]).toMatchObject({
				id: "developer",
				origin: "official",
				enabled: 1,
				nsfw: 0,
			});

			const rows = db.service.rawDb
				.prepare(
					"SELECT COUNT(*) AS n, SUM(list_id IS NOT NULL) AS withList FROM sources",
				)
				.get() as { n: number; withList: number };
			expect(rows.n).toBeGreaterThanOrEqual(20);
			expect(rows.withList).toBe(rows.n);
		} finally {
			db.close();
		}
	});

	it("backfill only touches seed sources — user-created sources keep list_id NULL", () => {
		const db = createTestDb();
		try {
			db.service.rawDb
				.prepare(
					`INSERT INTO sources (id, name, url, type, category, adapter, list_id)
					 VALUES ('src-user', 'User source', 'https://user.example', 'rss', 'other', 'rss', NULL)`,
				)
				.run();

			// Re-run the seeder — as startup does on every boot — and confirm the
			// user source is never hijacked into a list.
			seedSourceLists(db.service.rawDb);

			const row = db.service.rawDb
				.prepare("SELECT list_id FROM sources WHERE id = 'src-user'")
				.get() as { list_id: string | null };
			expect(row.list_id).toBeNull();
		} finally {
			db.close();
		}
	});

	it("list() reports live source + enabled counts", async () => {
		const db = createTestDb();
		try {
			const lists = await makeLists(db).list();
			const dev = lists.find((l) => l.id === "developer");
			expect(dev).toBeDefined();
			expect(dev!.origin).toBe("official");
			expect(dev!.sourceCount).toBeGreaterThanOrEqual(20);
			expect(dev!.enabledCount).toBe(dev!.sourceCount);
		} finally {
			db.close();
		}
	});
});

describe("source lists: enable / disable lifecycle (R-A10)", () => {
	it("disable hides the list but keeps every source row and its edits", async () => {
		const db = createTestDb();
		try {
			const lists = makeLists(db);

			// Rename a seed source — the user edit that must survive.
			db.service.rawDb
				.prepare("UPDATE sources SET name = 'User renamed' WHERE id = ?")
				.run("src-nodejs");

			const disabled = await lists.disable("developer");
			expect(disabled.enabled).toBe(false);

			// Rows are kept.
			const rows = db.service.rawDb
				.prepare(
					"SELECT COUNT(*) AS n FROM sources WHERE list_id = 'developer'",
				)
				.get() as { n: number };
			expect(rows.n).toBeGreaterThanOrEqual(20);
			// And the edit is still there.
			const name = db.service.rawDb
				.prepare("SELECT name FROM sources WHERE id = 'src-nodejs'")
				.get() as { name: string };
			expect(name.name).toBe("User renamed");

			// The crawler gate sees no enabled lists.
			await expect(lists.getEnabledListIds()).resolves.toEqual(new Set());
		} finally {
			db.close();
		}
	});

	it("enable materializes missing sources from the cached catalog and preserves edits", async () => {
		const db = createTestDb();
		try {
			const lists = makeLists(db);

			// Rename one seed source, then delete another row entirely — as if a
			// partial cleanup happened. Re-enabling must not resurrect the rename
			// and must re-materialize the missing row.
			db.service.rawDb
				.prepare("UPDATE sources SET name = 'Kept rename' WHERE id = ?")
				.run("src-go-blog");
			db.service.rawDb
				.prepare("DELETE FROM sources WHERE id = ?")
				.run("src-vercel");

			await lists.disable("developer");
			await lists.enable("developer");

			const missing = db.service.rawDb
				.prepare("SELECT id FROM sources WHERE id = 'src-vercel'")
				.get();
			expect(missing).toBeDefined();
			const renamed = db.service.rawDb
				.prepare("SELECT name FROM sources WHERE id = 'src-go-blog'")
				.get() as { name: string };
			expect(renamed.name).toBe("Kept rename");

			await expect(lists.getEnabledListIds()).resolves.toEqual(
				new Set(["developer"]),
			);
		} finally {
			db.close();
		}
	});

	it("enable is idempotent — re-enabling never duplicates rows", async () => {
		const db = createTestDb();
		try {
			const lists = makeLists(db);
			await lists.disable("developer");
			await lists.enable("developer");
			await lists.enable("developer");
			const rows = db.service.rawDb
				.prepare(
					"SELECT COUNT(*) AS n, COUNT(DISTINCT id) AS d FROM sources WHERE list_id = 'developer'",
				)
				.get() as { n: number; d: number };
			expect(rows.n).toBe(rows.d);
		} finally {
			db.close();
		}
	});
});

describe("source lists: community catalog refresh (offline)", () => {
	/** Build a fetcher serving canned GitHub trees + raw responses. */
	function makeFetcher(
		rawFiles: Record<string, string | null>,
		paths = Object.keys(rawFiles),
	): CatalogFetcher {
		const treeUrl =
			"https://api.github.com/repos/omidnw/vorynth/git/trees/master?recursive=1";
		const responses: Record<string, string | null> = {
			[treeUrl]: JSON.stringify({
				tree: paths.map((p) => ({ path: p, type: "blob" })),
			}),
		};
		for (const [path, body] of Object.entries(rawFiles)) {
			responses[
				`https://raw.githubusercontent.com/omidnw/vorynth/master/${path}`
			] = body;
		}
		return { getText: async (url) => responses[url] ?? null };
	}

	const securityList = JSON.stringify({
		id: "security-news",
		name: "Security News",
		description: "Community security feeds",
		nsfw: false,
		version: "1.0.0",
		sources: [
			{
				id: "src-sec-snyk",
				name: "Snyk Security",
				url: "https://snyk.io/blog/feed.xml",
				type: "rss",
				adapter: "rss",
				category: "security",
				configuration: { feedUrl: "https://snyk.io/blog/feed.xml" },
			},
		],
	});

	it("downloads new community lists hidden by default, deriving the curator from the path", async () => {
		const db = createTestDb();
		try {
			const lists = makeLists(
				db,
				makeFetcher({
					"sources/security.json": securityList,
					"sources/jane/kubernetes.json": JSON.stringify({
						id: "kubernetes-ops",
						name: "Kubernetes Ops",
						description: "K8s feeds",
						nsfw: false,
						version: "1.0.0",
						sources: [
							{
								id: "src-k8s",
								name: "K8s Blog",
								url: "https://k8s.io/blog/feed.xml",
								type: "rss",
								adapter: "rss",
								category: "devops",
								configuration: { feedUrl: "https://k8s.io/blog/feed.xml" },
							},
						],
					}),
				}),
			);

			const result = await lists.refreshCatalog();
			expect(result.added.sort()).toEqual(["kubernetes-ops", "security-news"]);

			const infos = await lists.list();
			const security = infos.find((l) => l.id === "security-news")!;
			expect(security).toMatchObject({
				origin: "community",
				nsfw: false,
				version: "1.0.0",
				curator: null, // flat file → general list
				enabled: false, // opt-in — new lists start hidden
			});
			const k8s = infos.find((l) => l.id === "kubernetes-ops")!;
			expect(k8s.curator).toBe("jane"); // per-author folder

			// Cached sources_json means enabling works fully offline.
			await lists.enable("security-news");
			const src = db.service.rawDb
				.prepare("SELECT name FROM sources WHERE id = 'src-sec-snyk'")
				.get() as { name: string };
			expect(src.name).toBe("Snyk Security");
		} finally {
			db.close();
		}
	});

	it("skips invalid entries — unknown adapter, bad config, empty list (R-A06)", async () => {
		const db = createTestDb();
		try {
			const lists = makeLists(
				db,
				makeFetcher({
					// Unknown adapter → source dropped → list has no usable sources.
					"sources/bad-adapter.json": JSON.stringify({
						id: "bad-adapter",
						name: "Bad Adapter",
						sources: [
							{
								id: "src-x",
								name: "X",
								url: "https://x.example",
								type: "rss",
								adapter: "no-such-adapter",
								configuration: {},
							},
						],
					}),
					// Missing required feedUrl → config invalid → dropped.
					"sources/bad-config.json": JSON.stringify({
						id: "bad-config",
						name: "Bad Config",
						sources: [
							{
								id: "src-y",
								name: "Y",
								url: "https://y.example",
								type: "rss",
								adapter: "rss",
								configuration: {},
							},
						],
					}),
					// An official list id can't be overridden by the community catalog.
					"sources/developer.json": JSON.stringify({
						id: "developer",
						name: "Spoofed Official",
						sources: [
							{
								id: "src-z",
								name: "Z",
								url: "https://z.example",
								type: "rss",
								adapter: "rss",
								configuration: { feedUrl: "https://z.example/feed.xml" },
							},
						],
					}),
					"sources/valid.json": JSON.stringify({
						id: "valid-list",
						name: "Valid List",
						sources: [
							{
								id: "src-good",
								name: "Good",
								url: "https://good.example/feed.xml",
								type: "rss",
								adapter: "rss",
								category: "security",
								configuration: { feedUrl: "https://good.example/feed.xml" },
							},
						],
					}),
				}),
			);

			const result = await lists.refreshCatalog();
			// Only the fully-valid list lands; the others are skipped, not stored.
			expect(result.added).toEqual(["valid-list"]);
			expect(result.skipped).toHaveLength(3);

			const infos = await lists.list();
			expect(infos.find((l) => l.id === "bad-adapter")).toBeUndefined();
			expect(infos.find((l) => l.id === "bad-config")).toBeUndefined();
			expect(infos.find((l) => l.id === "developer")!.name).toBe(
				"Developer & Software Engineering", // untouched official seed
			);
		} finally {
			db.close();
		}
	});

	it("upsert preserves the user's enabled state and reports changes", async () => {
		const db = createTestDb();
		try {
			const lists = makeLists(
				db,
				makeFetcher({ "sources/security.json": securityList }),
			);
			await lists.refreshCatalog();

			// The user opts in — enabling a community list.
			await lists.enable("security-news");

			// A refresh with changed content must keep it enabled (updated).
			const v2 = makeFetcher({
				"sources/security.json": securityList.replace('"1.0.0"', '"1.1.0"'),
			});
			const listsV2 = makeLists(db, v2);
			const changed = await listsV2.refreshCatalog();
			expect(changed.updated).toEqual(["security-news"]);
			const afterChange = (await listsV2.list()).find(
				(l) => l.id === "security-news",
			)!;
			expect(afterChange.enabled).toBe(true);

			// An identical refresh is a no-op.
			const unchanged = await listsV2.refreshCatalog();
			expect(unchanged.unchanged).toEqual(["security-news"]);
		} finally {
			db.close();
		}
	});

	it("a failed refresh throws but never clears the cached catalog", async () => {
		const db = createTestDb();
		try {
			const lists = makeLists(
				db,
				makeFetcher({ "sources/security.json": securityList }),
			);
			await lists.refreshCatalog();
			await lists.enable("security-news");

			// Catalog unreachable (trees API returns null).
			const offline = makeLists(db, {
				getText: async () => null,
			});
			await expect(offline.refreshCatalog()).rejects.toBeInstanceOf(
				ServiceUnavailableException,
			);

			// Everything is intact — the stored rows ARE the offline catalog.
			const infos = await offline.list();
			const security = infos.find((l) => l.id === "security-news");
			expect(security).toBeDefined();
			expect(security!.enabled).toBe(true);
			const src = db.service.rawDb
				.prepare("SELECT id FROM sources WHERE id = 'src-sec-snyk'")
				.get();
			expect(src).toBeDefined();
		} finally {
			db.close();
		}
	});

	it("lists whose file left the repo stay cached and are reported as removed", async () => {
		const db = createTestDb();
		try {
			const lists = makeLists(
				db,
				makeFetcher({ "sources/security.json": securityList }),
			);
			await lists.refreshCatalog();

			// The file disappears from the repo on the next refresh.
			const shrunk = makeLists(db, makeFetcher({}));
			const result = await shrunk.refreshCatalog();
			expect(result.removed).toEqual(["security-news"]);

			// Still cached and usable offline (R-A10 — nothing silently vanishes).
			const stillThere = (await shrunk.list()).find(
				(l) => l.id === "security-news",
			);
			expect(stillThere).toBeDefined();
		} finally {
			db.close();
		}
	});
});

describe("domain invariant: the crawler gates on list.enabled (v1.8.0)", () => {
	it("a source whose list is off is skipped before the adapter runs; re-enabling restores collection", async () => {
		const db = createTestDb();
		try {
			const lists = makeLists(db);
			// A list source with an empty config: if the adapter is reached, its
			// validate() rejects (proving the short-circuit path on the way out).
			db.service.rawDb
				.prepare(
					`INSERT INTO sources (id, name, url, type, category, adapter, list_id)
					 VALUES ('src-listed', 'Listed', 'https://example.com', 'html', 'other', 'html', 'developer')`,
				)
				.run();

			const crawler = makeCrawler(db);

			// List on → the adapter is reached and rejects the empty config.
			const enabledErr = await crawler.collectSource("src-listed").then(
				() => null,
				(e) => e,
			);
			expect(enabledErr?.message).toContain("rejected config");

			// List off → short-circuits with [] and never touches the adapter.
			await lists.disable("developer");
			await expect(crawler.collectSource("src-listed")).resolves.toEqual([]);

			// Re-enabling restores collection (rows were never deleted).
			await lists.enable("developer");
			const restoredErr = await crawler.collectSource("src-listed").then(
				() => null,
				(e) => e,
			);
			expect(restoredErr?.message).toContain("rejected config");
		} finally {
			db.close();
		}
	});
});

describe("source lists: import (v1.8.0)", () => {
	const VALID_FILE = JSON.stringify({
		id: "my-feeds",
		name: "My Feeds",
		description: "Cool feeds",
		nsfw: false,
		version: "1",
		sources: [
			{
				id: "src-blog",
				name: "Example Blog",
				url: "https://example.com/feed.xml",
				type: "rss",
				category: "ai",
				adapter: "rss",
				configuration: { feedUrl: "https://example.com/feed.xml" },
				fetchWindowDays: 7,
			},
		],
	});

	it("imports a valid my-sources.json as a local list and materializes it on enable", async () => {
		const db = createTestDb();
		try {
			// onModuleInit registers the built-in adapters parseSourceDef gates on.
			const plugins = makePlugins(db);
			plugins.onModuleInit();
			const lists = new SourceListsService(db.service, plugins);
			const imported = await lists.importListFile(VALID_FILE);
			expect(imported).toMatchObject({
				id: "my-feeds",
				name: "My Feeds",
				origin: "import",
				enabled: false,
			});
			expect(imported.sourceCount).toBe(0);

			const enabled = await lists.enable("my-feeds");
			expect(enabled.enabled).toBe(true);
			expect(enabled.sourceCount).toBe(1);

			const row = db.service.rawDb
				.prepare("SELECT COUNT(*) AS n FROM sources WHERE id = 'src-blog'")
				.get() as { n: number };
			expect(row.n).toBe(1);
		} finally {
			db.close();
		}
	});

	it("rejects malformed JSON", async () => {
		const db = createTestDb();
		try {
			const lists = makeLists(db);
			await expect(lists.importListFile("{not json")).rejects.toThrow(
				"sourceList.importInvalidJson",
			);
		} finally {
			db.close();
		}
	});

	it("rejects a file with no usable sources", async () => {
		const db = createTestDb();
		try {
			const lists = makeLists(db);
			const bad = JSON.stringify({
				id: "empty",
				name: "Empty",
				sources: [],
			});
			await expect(lists.importListFile(bad)).rejects.toThrow(
				"sourceList.importInvalid",
			);
		} finally {
			db.close();
		}
	});
});
