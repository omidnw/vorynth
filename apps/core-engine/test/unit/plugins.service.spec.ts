import { PluginsService } from "../../src/modules/plugins/plugins.service.js";
import { ConnectorRegistryService } from "../../src/modules/connector-registry/connector-registry.service.js";
import { createTestDb, type TestDb } from "../helpers/db.js";
import {
	BadRequestException,
	ConflictException,
	NotFoundException,
} from "@nestjs/common";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { strToU8, zipSync } from "fflate";
import type { InstalledPluginManifest } from "@vorynth/types";

/**
 * Plugin registry tests (v1.8.0):
 *   • manifests are seeded into the plugins table idempotently
 *   • every plugin — core included — toggles and gates isEnabled
 *   • the reference UI plugin ships disabled
 *   • adapterFor maps every source type to the right adapter
 *   • validateConfig enforces required fields against the manifest schema
 *   • installed plugins: folder scan registers/drops, uninstall refuses
 *     built-ins and source-referenced plugins, bundles are served
 *
 * Official connectors (arXiv) are no longer code-registered — they arrive via
 * the GitHub connector registry, covered in connector-registry.spec.ts.
 */

/** Build a PluginsService with a real (offline, table-backed) registry. */
function makeService(db: TestDb): PluginsService {
	return new PluginsService(
		db.service,
		new ConnectorRegistryService(db.service),
	);
}

describe("PluginsService", () => {
	it("seeds one plugin row per manifest on init (idempotent)", async () => {
		const db = createTestDb();
		try {
			const svc = makeService(db);
			svc.onModuleInit();
			svc.onModuleInit(); // idempotent

			const rows = db.service.rawDb
				.prepare("SELECT id, name, type, enabled FROM plugins ORDER BY id")
				.all() as { id: string; name: string; type: string; enabled: number }[];

			expect(rows.map((r) => r.id)).toEqual([
				"api",
				"github-releases",
				"html",
				"icons",
				"media-copyright",
				"reddit",
				"reference",
				"rss",
				"sitemap",
				"story-renderer",
			]);
			// Every plugin ships enabled (core + optional adapters + locked UI
			// plugins); only the reference UI plugin ships off.
			expect(
				rows.filter((r) => r.id !== "reference").every((r) => r.enabled === 1),
			).toBe(true);
			expect(rows.find((r) => r.id === "reference")?.enabled).toBe(0);
		} finally {
			db.close();
		}
	});

	it("sitemap and api are core adapters alongside rss/github", async () => {
		const db = createTestDb();
		try {
			const svc = makeService(db);
			const list = await svc.list();
			const coreIds = list.filter((p) => p.core).map((p) => p.id);
			expect(coreIds.sort()).toEqual([
				"api",
				"github-releases",
				"icons",
				"media-copyright",
				"rss",
				"sitemap",
				"story-renderer",
			]);
		} finally {
			db.close();
		}
	});

	it("the Icon Pack core UI plugin seeds with type 'icons' and contribution tags", async () => {
		const db = createTestDb();
		try {
			const svc = makeService(db);
			svc.onModuleInit();
			const list = await svc.list();

			const icons = list.find((p) => p.id === "icons");
			expect(icons).toMatchObject({
				kind: "ui",
				type: "icons",
				core: true,
				enabled: true,
				effectiveEnabled: true,
				contributions: ["icons", "fonts"],
			});
			// The reference plugin's theme contribution tag is surfaced too.
			expect(list.find((p) => p.id === "reference")?.contributions).toEqual([
				"theme",
			]);
			// Adapters declare no contributions.
			expect(list.find((p) => p.id === "rss")?.contributions).toBeUndefined();
		} finally {
			db.close();
		}
	});

	it("the Icon Pack is locked: always enabled, disable refused, config still writable", async () => {
		const db = createTestDb();
		try {
			const svc = makeService(db);
			svc.onModuleInit();

			// Locked and always reported enabled.
			const list = await svc.list();
			const icons = list.find((p) => p.id === "icons");
			expect(icons).toMatchObject({
				locked: true,
				enabled: true,
				effectiveEnabled: true,
			});
			expect(await svc.isEnabled("icons")).toBe(true);

			// Other plugins are not locked.
			expect(list.find((p) => p.id === "rss")?.locked).toBe(false);
			expect(list.find((p) => p.id === "reference")?.locked).toBe(false);

			// Disabling it is refused with PLUGIN_LOCKED.
			let err: unknown;
			try {
				await svc.update("icons", { enabled: false });
			} catch (e) {
				err = e;
			}
			expect(err).toBeInstanceOf(ConflictException);
			expect((err as ConflictException).getResponse()).toMatchObject({
				code: "PLUGIN_LOCKED",
			});

			// Re-enabling an already-on locked plugin is a harmless no-op.
			await expect(
				svc.update("icons", { enabled: true }),
			).resolves.toMatchObject({
				locked: true,
				enabled: true,
			});

			// Configuration still persists for UI plugins (locking only covers the toggle).
			await svc.update("icons", { configuration: { dense: true } });
			expect(await svc.getConfiguration("icons")).toEqual({ dense: true });

			// Self-healing: even a stale pre-lock disabled row reports enabled.
			db.service.rawDb
				.prepare("UPDATE plugins SET enabled = 0 WHERE id = 'icons'")
				.run();
			const after = await svc.list();
			expect(after.find((p) => p.id === "icons")).toMatchObject({
				enabled: true,
				effectiveEnabled: true,
			});
			expect(await svc.isEnabled("icons")).toBe(true);

			// The startup seed repairs the stale row itself.
			svc.onModuleInit();
			const row = db.service.rawDb
				.prepare("SELECT enabled FROM plugins WHERE id = 'icons'")
				.get() as { enabled: number };
			expect(row.enabled).toBe(1);
		} finally {
			db.close();
		}
	});

	it("core adapters can be disabled and re-enabled, gating isEnabled", async () => {
		const db = createTestDb();
		try {
			const svc = makeService(db);
			svc.onModuleInit();

			// RSS is core — it still toggles.
			expect(await svc.isEnabled("rss")).toBe(true);
			const off = await svc.setEnabled("rss", { enabled: false });
			expect(off.enabled).toBe(false);
			expect(off.effectiveEnabled).toBe(false);
			expect(await svc.isEnabled("rss")).toBe(false);

			// Re-enable restores the previous state.
			const on = await svc.setEnabled("rss", { enabled: true });
			expect(on.enabled).toBe(true);
			expect(await svc.isEnabled("rss")).toBe(true);
		} finally {
			db.close();
		}
	});

	it("non-core adapters toggle and gate isEnabled", async () => {
		const db = createTestDb();
		try {
			const svc = makeService(db);
			svc.onModuleInit();

			expect(await svc.isEnabled("html")).toBe(true);
			await svc.setEnabled("html", { enabled: false });
			expect(await svc.isEnabled("html")).toBe(false);
			const list = await svc.list();
			expect(list.find((p) => p.id === "html")?.enabled).toBe(false);
			expect(list.find((p) => p.id === "html")?.effectiveEnabled).toBe(false);
		} finally {
			db.close();
		}
	});

	it("adapterFor resolves every built-in source type to its adapter", async () => {
		const db = createTestDb();
		try {
			const svc = makeService(db);
			expect(svc.adapterFor("rss")).toBe("rss");
			expect(svc.adapterFor("github")).toBe("github-releases");
			expect(svc.adapterFor("html")).toBe("html");
			expect(svc.adapterFor("sitemap")).toBe("sitemap");
			expect(svc.adapterFor("api")).toBe("api");
			expect(svc.adapterFor("reddit")).toBe("reddit");
			// arXiv is NOT built-in — it resolves only once its official
			// connector is registered from the GitHub registry (see
			// connector-registry.spec.ts for the provisioned path).
			expect(() => svc.adapterFor("arxiv")).toThrow(
				"no adapter registered for source type 'arxiv'",
			);
		} finally {
			db.close();
		}
	});

	it("adapterFor throws for an unknown source type", async () => {
		const db = createTestDb();
		try {
			const svc = makeService(db);
			expect(() => svc.adapterFor("nope" as never)).toThrow(
				"no adapter registered for source type 'nope'",
			);
		} finally {
			db.close();
		}
	});

	it("validateConfig enforces required fields (dotted keys included)", async () => {
		const db = createTestDb();
		try {
			const svc = makeService(db);
			// RSS requires feedUrl.
			expect(svc.validateConfig("rss", {})).toContain("missing required field");
			expect(
				svc.validateConfig("rss", { feedUrl: "https://x.com/feed" }),
			).toBeNull();
			// HTML requires crawl.url (dotted).
			expect(svc.validateConfig("html", {})).toContain(
				"missing required field",
			);
			expect(
				svc.validateConfig("html", { crawl: { url: "https://x.com" } }),
			).toBeNull();
			// API requires apiUrl + titleField.
			expect(
				svc.validateConfig("api", { api: { apiUrl: "https://x.com" } }),
			).toContain("missing required field");
			expect(
				svc.validateConfig("api", {
					api: { apiUrl: "https://x.com", titleField: "t" },
				}),
			).toBeNull();
			// Unknown adapter → error.
			expect(svc.validateConfig("nope", {})).toBe("no adapter 'nope'");
		} finally {
			db.close();
		}
	});

	it("list() returns manifests merged with enabled state", async () => {
		const db = createTestDb();
		try {
			const svc = makeService(db);
			svc.onModuleInit();
			const list = await svc.list();
			expect(list).toHaveLength(10);
			const html = list.find((p) => p.id === "html");
			expect(html).toMatchObject({
				name: "HTML Crawler",
				type: "html",
				kind: "adapter",
				core: false,
				enabled: true,
				effectiveEnabled: true,
			});
			expect(html?.configFields.length).toBeGreaterThan(0);
			expect(html?.configFields[0]).toMatchObject({
				key: "crawl.url",
				required: true,
			});
		} finally {
			db.close();
		}
	});

	it("every manifest declares an icon and list() surfaces it", async () => {
		const db = createTestDb();
		try {
			const svc = makeService(db);
			svc.onModuleInit();
			const list = await svc.list();
			// Every built-in plugin (adapters + UI) carries a manifest icon —
			// a Material Symbols ligature rendered from the offline Icon Pack.
			for (const p of list) {
				expect(p.icon).toBeDefined();
			}
			// Spot-check the adapter set + one UI plugin.
			expect(list.find((p) => p.id === "rss")?.icon).toBe("rss_feed");
			expect(list.find((p) => p.id === "github-releases")?.icon).toBe("hub");
			expect(list.find((p) => p.id === "html")?.icon).toBe("html");
			expect(list.find((p) => p.id === "sitemap")?.icon).toBe("map");
			expect(list.find((p) => p.id === "api")?.icon).toBe("api");
			expect(list.find((p) => p.id === "reddit")?.icon).toBe("forum");
			expect(list.find((p) => p.id === "icons")?.icon).toBe("palette");
		} finally {
			db.close();
		}
	});

	it("list() derives active from enabled sources using the adapter (never stored)", async () => {
		const db = createTestDb();
		try {
			const svc = makeService(db);
			svc.onModuleInit();
			const setEnabled = (id: string, enabled: 0 | 1) =>
				db.service.rawDb
					.prepare("UPDATE sources SET enabled = ? WHERE id = ?")
					.run(enabled, id);

			// Seeded DB: every starter source is enabled RSS → rss is in use,
			// other adapters idle, UI plugins never active (no adapter).
			const before = await svc.list();
			expect(before.find((p) => p.id === "rss")?.active).toBe(true);
			expect(before.find((p) => p.id === "html")?.active).toBe(false);
			expect(before.find((p) => p.id === "github-releases")?.active).toBe(
				false,
			);
			expect(before.find((p) => p.id === "icons")?.active).toBe(false);
			expect(before.find((p) => p.id === "reference")?.active).toBe(false);

			// Disable every source → rss goes idle.
			db.service.rawDb.prepare("UPDATE sources SET enabled = 0").run();
			const idle = await svc.list();
			expect(idle.find((p) => p.id === "rss")?.active).toBe(false);

			// Re-enable one source → rss is in use again.
			setEnabled("src-openai-blog", 1);
			const active = await svc.list();
			expect(active.find((p) => p.id === "rss")?.active).toBe(true);

			// Pausing the plugin does NOT change active — its sources are still
			// enabled; active is about sources, effectiveEnabled about the plugin.
			const patched = await svc.update("rss", { enabled: false });
			expect(patched.active).toBe(true);
		} finally {
			db.close();
		}
	});

	it("the reference UI plugin ships disabled with kind 'ui'", async () => {
		const db = createTestDb();
		try {
			const svc = makeService(db);
			svc.onModuleInit();
			const list = await svc.list();
			const ref = list.find((p) => p.id === "reference");
			expect(ref).toMatchObject({
				name: "Reference Plugin",
				kind: "ui",
				type: "reference",
				core: false,
				enabled: false,
				effectiveEnabled: false,
			});
			expect(ref?.configFields).toEqual([]);
		} finally {
			db.close();
		}
	});

	it("update() merges configuration shallowly and persists it", async () => {
		const db = createTestDb();
		try {
			const svc = makeService(db);
			svc.onModuleInit();

			await svc.update("reference", { configuration: { greeting: true } });
			await svc.update("reference", { configuration: { compact: false } });

			const got = await svc.getConfiguration("reference");
			expect(got).toEqual({ greeting: true, compact: false });

			// list() surfaces the merged configuration.
			const list = await svc.list();
			expect(list.find((p) => p.id === "reference")?.configuration).toEqual({
				greeting: true,
				compact: false,
			});
		} finally {
			db.close();
		}
	});
});

/**
 * Installed plugins (v1.8.0) — the folder install path. These tests pin the
 * plugins dir to each test's throwaway data dir so they never touch the real
 * `<cwd>/data/plugins` (the env override is restored after every test).
 */
describe("PluginsService — installed plugins (folder install/uninstall)", () => {
	const OLD_DATA_DIR = process.env.VORYNTH_DATA_DIR;

	/** Drop a valid plugin folder (`plugin.json` + `bundle.js`) into the data dir. */
	function dropPlugin(
		dir: string,
		id: string,
		overrides: Partial<InstalledPluginManifest> = {},
		bundle = "export default {};",
	): string {
		const pluginDir = join(dir, "plugins", id);
		mkdirSync(pluginDir, { recursive: true });
		writeFileSync(
			join(pluginDir, "plugin.json"),
			JSON.stringify({
				id,
				name: `Test ${id}`,
				description: "a dropped-in test plugin",
				version: "1.0.0",
				...overrides,
			}),
		);
		writeFileSync(join(pluginDir, "bundle.js"), bundle);
		return pluginDir;
	}

	/** Build a service whose plugin dir resolves inside the test's temp dir. */
	function makeService(db: TestDb): PluginsService {
		process.env.VORYNTH_DATA_DIR = db.dir;
		return new PluginsService(
			db.service,
			new ConnectorRegistryService(db.service),
		);
	}

	afterEach(() => {
		if (OLD_DATA_DIR === undefined) delete process.env.VORYNTH_DATA_DIR;
		else process.env.VORYNTH_DATA_DIR = OLD_DATA_DIR;
	});

	it("scan registers a dropped-in folder and list() surfaces it as installed", async () => {
		const db = createTestDb();
		try {
			dropPlugin(db.dir, "hello");
			const svc = makeService(db);
			expect(svc.scanInstalledPlugins().added).toEqual(["hello"]);

			const list = await svc.list();
			const hello = list.find((p) => p.id === "hello");
			expect(hello).toMatchObject({
				name: "Test hello",
				description: "a dropped-in test plugin",
				version: "1.0.0",
				kind: "ui",
				type: "custom",
				core: false,
				enabled: true,
				effectiveEnabled: true,
				installed: true,
				dependencies: [],
				configFields: [],
			});
			expect(list.filter((p) => p.installed)).toHaveLength(1);
		} finally {
			db.close();
		}
	});

	it("scan runs the security scan and list() surfaces the report", async () => {
		const db = createTestDb();
		try {
			// A bundle with an eval() call → HIGH severity report.
			dropPlugin(db.dir, "risky", {}, `const a = eval("1+1");`);
			const svc = makeService(db);
			svc.scanInstalledPlugins();

			const list = await svc.list();
			const risky = list.find((p) => p.id === "risky");
			expect(risky?.security).toMatchObject({
				severity: "high",
				scannedAt: expect.any(String),
			});
			expect(risky?.security?.flags[0]).toMatchObject({
				id: "eval",
				severity: "high",
			});
		} finally {
			db.close();
		}
	});

	it("a clean bundle produces a clean security report", async () => {
		const db = createTestDb();
		try {
			dropPlugin(db.dir, "clean");
			const svc = makeService(db);
			svc.scanInstalledPlugins();

			const list = await svc.list();
			const clean = list.find((p) => p.id === "clean");
			expect(clean?.security?.severity).toBe("clean");
			expect(clean?.security?.flags).toEqual([]);
		} finally {
			db.close();
		}
	});

	it("built-in plugins never carry a security report (trusted)", async () => {
		const db = createTestDb();
		try {
			const svc = makeService(db);
			const list = await svc.list();
			for (const plugin of list) {
				if (!plugin.installed) expect(plugin.security).toBeUndefined();
			}
		} finally {
			db.close();
		}
	});

	it("scan is idempotent — re-scanning does not re-register", async () => {
		const db = createTestDb();
		try {
			dropPlugin(db.dir, "hello");
			const svc = makeService(db);
			expect(svc.scanInstalledPlugins().added).toEqual(["hello"]);
			expect(svc.scanInstalledPlugins().added).toEqual([]);
			expect(svc.scanInstalledPlugins().removed).toEqual([]);
		} finally {
			db.close();
		}
	});

	it("scan drops rows whose folder disappeared", async () => {
		const db = createTestDb();
		try {
			dropPlugin(db.dir, "hello");
			const svc = makeService(db);
			expect(svc.scanInstalledPlugins().added).toEqual(["hello"]);

			rmSync(join(db.dir, "plugins", "hello"), {
				recursive: true,
				force: true,
			});
			expect(svc.scanInstalledPlugins().removed).toEqual(["hello"]);

			const list = await svc.list();
			expect(list.find((p) => p.id === "hello")).toBeUndefined();
		} finally {
			db.close();
		}
	});

	it("skips folders whose id collides with a built-in plugin", async () => {
		const db = createTestDb();
		try {
			dropPlugin(db.dir, "rss");
			const svc = makeService(db);
			svc.onModuleInit();
			expect(svc.scanInstalledPlugins().added).toEqual([]);
			expect(svc.installedRow("rss")).toBeUndefined();
		} finally {
			db.close();
		}
	});

	it("skips folders without a bundle or with an invalid manifest", async () => {
		const db = createTestDb();
		try {
			// Missing bundle.js.
			const noBundle = join(db.dir, "plugins", "nobundle");
			mkdirSync(noBundle, { recursive: true });
			writeFileSync(
				join(noBundle, "plugin.json"),
				JSON.stringify({ id: "nobundle", name: "X", version: "1.0.0" }),
			);
			// Manifest id does not match the folder name.
			const badId = join(db.dir, "plugins", "badid");
			mkdirSync(badId, { recursive: true });
			writeFileSync(
				join(badId, "plugin.json"),
				JSON.stringify({ id: "other", name: "X", version: "1.0.0" }),
			);
			writeFileSync(join(badId, "bundle.js"), "export {};");
			// Unreadable manifest.
			const broken = join(db.dir, "plugins", "broken");
			mkdirSync(broken, { recursive: true });
			writeFileSync(join(broken, "plugin.json"), "{ not json");
			writeFileSync(join(broken, "bundle.js"), "export {};");
			// Control — a valid folder still registers.
			dropPlugin(db.dir, "good");

			const svc = makeService(db);
			expect(svc.scanInstalledPlugins().added).toEqual(["good"]);
		} finally {
			db.close();
		}
	});

	it("uninstall refuses built-in plugins even with force (PLUGIN_IS_CORE)", async () => {
		const db = createTestDb();
		try {
			const svc = makeService(db);
			let err: unknown;
			try {
				svc.uninstall("rss");
			} catch (e) {
				err = e;
			}
			expect(err).toBeInstanceOf(ConflictException);
			expect((err as ConflictException).getResponse()).toMatchObject({
				code: "PLUGIN_IS_CORE",
			});
			expect(() => svc.uninstall("rss", true)).toThrow(ConflictException);
		} finally {
			db.close();
		}
	});

	it("uninstall 404s for a plugin that was never installed", async () => {
		const db = createTestDb();
		try {
			const svc = makeService(db);
			expect(() => svc.uninstall("nope")).toThrow(NotFoundException);
			await expect(svc.update("nope", { enabled: false })).rejects.toThrow(
				NotFoundException,
			);
		} finally {
			db.close();
		}
	});

	it("uninstall deletes the DB row and the on-disk bundle folder", async () => {
		const db = createTestDb();
		try {
			dropPlugin(db.dir, "hello");
			const svc = makeService(db);
			svc.scanInstalledPlugins();
			expect(svc.installedRow("hello")).toBeDefined();
			expect(existsSync(join(db.dir, "plugins", "hello", "bundle.js"))).toBe(
				true,
			);

			svc.uninstall("hello");
			expect(svc.installedRow("hello")).toBeUndefined();
			expect(existsSync(join(db.dir, "plugins", "hello"))).toBe(false);
			const list = await svc.list();
			expect(list.find((p) => p.id === "hello")).toBeUndefined();
		} finally {
			db.close();
		}
	});

	it("uninstall refuses while sources reference the plugin unless forced", async () => {
		const db = createTestDb();
		try {
			dropPlugin(db.dir, "hello");
			const svc = makeService(db);
			svc.scanInstalledPlugins();
			db.service.rawDb
				.prepare(
					"INSERT INTO sources (id, name, url, type, adapter) VALUES (?, 'S', 'https://x.com', 'rss', ?)",
				)
				.run("s1", "hello");

			let err: unknown;
			try {
				svc.uninstall("hello");
			} catch (e) {
				err = e;
			}
			expect(err).toBeInstanceOf(ConflictException);
			expect((err as ConflictException).getResponse()).toMatchObject({
				code: "SOURCES_REFERENCE_PLUGIN",
			});
			expect(svc.installedRow("hello")).toBeDefined();

			svc.uninstall("hello", true);
			expect(svc.installedRow("hello")).toBeUndefined();
		} finally {
			db.close();
		}
	});

	it("update()/getConfiguration() persist enable + config on installed plugins", async () => {
		const db = createTestDb();
		try {
			dropPlugin(db.dir, "hello");
			const svc = makeService(db);
			svc.scanInstalledPlugins();

			const off = await svc.update("hello", { enabled: false });
			expect(off.enabled).toBe(false);
			expect(off.installed).toBe(true);

			await svc.update("hello", { configuration: { greeting: true } });
			await svc.update("hello", { configuration: { compact: false } });
			expect(await svc.getConfiguration("hello")).toEqual({
				greeting: true,
				compact: false,
			});

			const list = await svc.list();
			expect(list.find((p) => p.id === "hello")?.configuration).toEqual({
				greeting: true,
				compact: false,
			});
		} finally {
			db.close();
		}
	});

	it("readBundle serves the plugin's bundle; pluginsDir exposes the folder", async () => {
		const db = createTestDb();
		try {
			dropPlugin(db.dir, "hello");
			const svc = makeService(db);
			svc.scanInstalledPlugins();

			expect(svc.readBundle("hello").toString("utf8")).toBe(
				"export default {};",
			);
			expect(svc.pluginsDir().dir).toBe(join(db.dir, "plugins"));
			expect(() => svc.readBundle("nope")).toThrow(NotFoundException);
		} finally {
			db.close();
		}
	});

	/** Build a `.vorynth-plugin` package (zip of plugin.json + bundle.js). */
	function makePackage(
		id: string,
		opts: {
			manifest?: Record<string, unknown>;
			bundle?: string;
			extra?: Record<string, string>;
		} = {},
	): Buffer {
		const files: Record<string, Uint8Array> = {
			"plugin.json": strToU8(
				JSON.stringify(
					opts.manifest ?? { id, name: `Test ${id}`, version: "1.0.0" },
				),
			),
			"bundle.js": strToU8(opts.bundle ?? "export default {};"),
		};
		for (const [name, text] of Object.entries(opts.extra ?? {})) {
			files[name] = strToU8(text);
		}
		return Buffer.from(zipSync(files));
	}

	it("installPackage installs a .vorynth-plugin package and writes the folder", async () => {
		const db = createTestDb();
		try {
			const svc = makeService(db);
			const info = await svc.installPackage(
				makePackage("hello", {
					manifest: {
						id: "hello",
						name: "Hello Plugin",
						description: "from a package",
						version: "2.0.0",
						contributions: ["theme"],
					},
					bundle: "export const themes = [];",
				}),
			);

			expect(info).toMatchObject({
				id: "hello",
				name: "Hello Plugin",
				version: "2.0.0",
				kind: "ui",
				installed: true,
				contributions: ["theme"],
			});
			expect(
				readFileSync(join(db.dir, "plugins", "hello", "bundle.js"), "utf8"),
			).toBe("export const themes = [];");
			expect(svc.installedRow("hello")).toBeDefined();
		} finally {
			db.close();
		}
	});

	it("installPackage rejects a body that isn't a zip", async () => {
		const db = createTestDb();
		try {
			const svc = makeService(db);
			await expect(
				svc.installPackage(Buffer.from("not a zip at all")),
			).rejects.toBeInstanceOf(BadRequestException);
		} finally {
			db.close();
		}
	});

	it("installPackage rejects a package without bundle.js", async () => {
		const db = createTestDb();
		try {
			const svc = makeService(db);
			// Only plugin.json — no bundle.
			const files: Record<string, Uint8Array> = {
				"plugin.json": strToU8(
					JSON.stringify({ id: "hello", name: "H", version: "1.0.0" }),
				),
			};
			await expect(
				svc.installPackage(Buffer.from(zipSync(files))),
			).rejects.toThrow("plugin.json manifest and a bundle.js");
		} finally {
			db.close();
		}
	});

	it("installPackage rejects a malformed manifest (missing version)", async () => {
		const db = createTestDb();
		try {
			const svc = makeService(db);
			await expect(
				svc.installPackage(
					makePackage("hello", { manifest: { id: "hello", name: "H" } }),
				),
			).rejects.toBeInstanceOf(BadRequestException);
		} finally {
			db.close();
		}
	});

	it("installPackage refuses ids that collide with a built-in plugin", async () => {
		const db = createTestDb();
		try {
			const svc = makeService(db);
			let err: unknown;
			try {
				await svc.installPackage(makePackage("rss"));
			} catch (e) {
				err = e;
			}
			expect(err).toBeInstanceOf(ConflictException);
			expect((err as ConflictException).getResponse()).toMatchObject({
				code: "PLUGIN_IS_CORE",
			});
		} finally {
			db.close();
		}
	});

	it("reinstalling an existing package refreshes the manifest but keeps state", async () => {
		const db = createTestDb();
		try {
			const svc = makeService(db);
			await svc.installPackage(
				makePackage("hello", {
					manifest: { id: "hello", name: "v1", version: "1.0.0" },
				}),
			);
			// User disables it and persists a config value.
			await svc.update("hello", {
				enabled: false,
				configuration: { greeting: true },
			});

			// Reinstall a newer package of the same id.
			await svc.installPackage(
				makePackage("hello", {
					manifest: { id: "hello", name: "v2", version: "2.0.0" },
					bundle: "export const navItems = [];",
				}),
			);

			const row = svc.installedRow("hello");
			expect(row).toMatchObject({ name: "v2", version: "2.0.0" });
			// Enabled + configuration survive a reinstall.
			expect(row?.enabled).toBe(false);
			expect(row?.configuration).toEqual({ greeting: true });
			expect(
				readFileSync(join(db.dir, "plugins", "hello", "bundle.js"), "utf8"),
			).toBe("export const navItems = [];");
		} finally {
			db.close();
		}
	});

	it("installPackage drops zip-slip entries (../, absolute paths)", async () => {
		const db = createTestDb();
		try {
			const svc = makeService(db);
			const files: Record<string, Uint8Array> = {
				"plugin.json": strToU8(
					JSON.stringify({ id: "hello", name: "H", version: "1.0.0" }),
				),
				"bundle.js": strToU8("export {};"),
				"../evil.txt": strToU8("nope"),
				"/abs/evil.txt": strToU8("nope"),
			};
			await svc.installPackage(Buffer.from(zipSync(files)));

			// Nothing escaped the plugin's folder.
			expect(existsSync(join(db.dir, "evil.txt"))).toBe(false);
			expect(existsSync(join(db.dir, "plugins", "..", "evil.txt"))).toBe(false);
			// The plugin itself is intact.
			expect(existsSync(join(db.dir, "plugins", "hello", "bundle.js"))).toBe(
				true,
			);
		} finally {
			db.close();
		}
	});

	it("installPackage scans the freshly written bundle too", async () => {
		const db = createTestDb();
		try {
			const svc = makeService(db);
			const installed = await svc.installPackage(
				makePackage("hello", {
					bundle: `fetch("https://evil.example/x");`,
				}),
			);
			expect(installed.security).toMatchObject({
				severity: "medium",
			});
			expect(installed.security?.flags[0]).toMatchObject({
				id: "external-url",
				severity: "medium",
			});
		} finally {
			db.close();
		}
	});

	it("an installed package can be uninstalled like a dropped-in plugin", async () => {
		const db = createTestDb();
		try {
			const svc = makeService(db);
			await svc.installPackage(makePackage("hello"));
			expect(svc.installedRow("hello")).toBeDefined();

			svc.uninstall("hello");
			expect(svc.installedRow("hello")).toBeUndefined();
			expect(existsSync(join(db.dir, "plugins", "hello"))).toBe(false);
		} finally {
			db.close();
		}
	});
});
