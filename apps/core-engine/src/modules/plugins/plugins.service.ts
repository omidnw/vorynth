import {
	BadRequestException,
	ConflictException,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
	type OnModuleInit,
} from "@nestjs/common";
import { eq } from "drizzle-orm";
import { unzipSync, strFromU8 } from "fflate";
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { join, resolve, sep } from "node:path";
import { DatabaseService } from "../../db/database.service.js";
import { resolvePluginsDir } from "../../db/paths.js";
import {
	installedPlugins,
	plugins,
	type InstalledPluginRow,
} from "../../db/schema.js";
import type {
	InstalledPluginManifest,
	PluginInfo,
	PluginScanResult,
	SourceType,
	UpdatePluginInput,
} from "@vorynth/types";
import {
	ALL_PLUGIN_MANIFESTS,
	manifestForType,
	type AdapterManifest,
} from "./plugins.manifests.js";
import { scanPluginBundle } from "./security-scan.js";
import { ConnectorRegistryService } from "../connector-registry/connector-registry.service.js";

/**
 * Plugin registry (v1.8.0 — "adapter-as-plugin" + runtime UI plugins +
 * user-installed plugins).
 *
 * Owns the built-in plugin manifests and the persisted enable/disable state +
 * per-plugin configuration in the `plugins` table, PLUS user-installed plugins
 * whose manifests live in the `installed_plugins` table (they have no code
 * manifest — their `plugin.json` is stored alongside the bundle on disk).
 * The crawler consults `isEnabled(adapter)` before running a source;
 * `SourcesService` uses `adapterFor(type)` to resolve which adapter a source
 * type maps to; the desktop reads `list()` to know which runtime UI plugins
 * to load.
 *
 * Persistence is minimal on purpose: built-in manifests live in code (R-A09),
 * the table stores only the user's toggle + configuration. Every plugin —
 * core included — can be disabled; disabling an adapter only pauses collection
 * of its sources (the crawler gates on `isEnabled`), never touching the source
 * rows, so re-enabling restores each source's previous state untouched. UI
 * plugins (kind "ui") contribute nav/settings/docs/theme at runtime from code
 * the desktop loads.
 *
 * Installed plugins (v1.8.0) are UI-only and live in `data/plugins/<id>/`:
 * drop a folder with `plugin.json` + `bundle.js` and press "Scan" (or restart)
 * to register it. Uninstalling one removes its DB row and its folder. Built-in
 * plugins can never be uninstalled — only disabled.
 */
@Injectable()
export class PluginsService implements OnModuleInit {
	private readonly logger = new Logger("Plugins");

	constructor(
		@Inject(DatabaseService) private readonly db: DatabaseService,
		@Inject(ConnectorRegistryService)
		private readonly registry: ConnectorRegistryService,
	) {}

	onModuleInit() {
		this.seed();
		try {
			this.scanInstalledPlugins();
		} catch (err) {
			// A broken data/plugins dir must never take the engine down.
			this.logger.warn(
				`plugins scan failed: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	}

	/** INSERT OR IGNORE each manifest into the plugins table (idempotent). */
	private seed(): void {
		const raw = this.db.rawDb;
		const stmt = raw.prepare(
			`INSERT OR IGNORE INTO plugins (id, name, type, configuration, enabled)
			 VALUES (?, ?, ?, '{}', ?)`,
		);
		raw.transaction(() => {
			// Built-ins + official connectors both seed (and manage) the same way.
			for (const m of ALL_PLUGIN_MANIFESTS) {
				stmt.run(m.id, m.name, m.type, m.enabledByDefault === false ? 0 : 1);
			}
			// Locked plugins are always on by design — repair any disabled state
			// persisted before the lock (their toggle is meaningless now).
			const lockStmt = raw.prepare(
				"UPDATE plugins SET enabled = 1 WHERE id = ?",
			);
			for (const m of ALL_PLUGIN_MANIFESTS) {
				if (m.locked) lockStmt.run(m.id);
			}
		})();
		this.logger.log(`seeded ${ALL_PLUGIN_MANIFESTS.length} plugins`);
	}

	/**
	 * Register user-installed plugins from `data/plugins/`. Each subdirectory
	 * must contain a `plugin.json` manifest + a `bundle.js`. Idempotent: rows
	 * whose folder still exists are left untouched; folders that disappeared
	 * drop their rows (the bundle is already gone). Returns what changed.
	 */
	scanInstalledPlugins(): PluginScanResult {
		const dir = resolvePluginsDir();
		const result: PluginScanResult = { added: [], removed: [] };

		// Folders present on disk → ensure a row exists.
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			if (!entry.isDirectory()) continue;
			const id = entry.name;
			if (this.manifest(id)) continue; // built-in id — never collide
			const manifestFile = join(dir, id, "plugin.json");
			const bundleFile = join(dir, id, "bundle.js");
			if (!existsSync(manifestFile) || !existsSync(bundleFile)) continue;
			let manifest: InstalledPluginManifest;
			try {
				manifest = JSON.parse(
					readFileSync(manifestFile, "utf8"),
				) as InstalledPluginManifest;
			} catch {
				this.logger.warn(`plugin ${id}: unreadable plugin.json, skipping`);
				continue;
			}
			if (
				!manifest?.id ||
				manifest.id !== id ||
				!manifest.name ||
				!manifest.version
			) {
				this.logger.warn(`plugin ${id}: invalid plugin.json, skipping`);
				continue;
			}
			const inserted = this.ensureInstalledRow(manifest, id);
			if (inserted) result.added.push(id);
			// Fresh security scan on every scan — the bundle may have changed
			// since it was last registered (scanPluginBundle is cheap regex).
			this.scanAndPersist(id, bundleFile);
		}

		// Rows in the DB whose folder vanished → drop the row.
		const rows = this.db.db.select().from(installedPlugins).all();
		for (const row of rows) {
			if (!existsSync(join(dir, row.bundlePath))) {
				this.db.db
					.delete(installedPlugins)
					.where(eq(installedPlugins.id, row.id))
					.run();
				result.removed.push(row.id);
				this.logger.log(`plugin ${row.id}: folder removed, uninstalled`);
			}
		}

		if (result.added.length || result.removed.length) {
			this.logger.log(
				`plugins scan: +${result.added.length} -${result.removed.length}`,
			);
		}
		return result;
	}

	/** INSERT OR IGNORE an installed row for a validated folder. */
	private ensureInstalledRow(
		manifest: InstalledPluginManifest,
		id: string,
	): boolean {
		const existing = this.db.db
			.select({ id: installedPlugins.id })
			.from(installedPlugins)
			.where(eq(installedPlugins.id, id))
			.limit(1)
			.all();
		if (existing.length > 0) return false;
		this.db.db
			.insert(installedPlugins)
			.values({
				id,
				name: manifest.name,
				description: manifest.description ?? "",
				version: manifest.version,
				contributions: manifest.contributions ?? [],
				bundlePath: id,
			})
			.run();
		this.logger.log(`plugin ${id} installed from data/plugins`);
		return true;
	}

	/**
	 * Run the static security scan over an installed plugin's `bundle.js` and
	 * persist the report. Never throws — an unreadable bundle leaves the
	 * previous report (or null) in place and logs the failure.
	 */
	private scanAndPersist(id: string, bundleFile: string): void {
		try {
			const code = readFileSync(bundleFile, "utf8");
			this.db.db
				.update(installedPlugins)
				.set({ securityScan: scanPluginBundle(code) })
				.where(eq(installedPlugins.id, id))
				.run();
		} catch (err) {
			this.logger.warn(
				`plugin ${id}: security scan failed: ${
					err instanceof Error ? err.message : String(err)
				}`,
			);
		}
	}

	/** All manifests the plugin system knows: code-registered built-ins +
	 *  official connectors provisioned from the GitHub registry, in order. */
	manifests(): AdapterManifest[] {
		return [
			...ALL_PLUGIN_MANIFESTS,
			...this.registry
				.registeredRows()
				.map((r) => this.registry.registeredManifest(r.id))
				.filter((m): m is AdapterManifest => m !== null),
		];
	}

	/** A manifest by plugin id — built-in or a registered official connector. */
	manifest(id: string): AdapterManifest | undefined {
		return (
			ALL_PLUGIN_MANIFESTS.find((m) => m.id === id) ??
			this.registry.registeredManifest(id) ??
			undefined
		);
	}

	/** An installed plugin row by id. */
	installedRow(id: string): InstalledPluginRow | undefined {
		const rows = this.db.db
			.select()
			.from(installedPlugins)
			.where(eq(installedPlugins.id, id))
			.limit(1)
			.all();
		return rows[0];
	}

	/** Merge built-in + registry-provisioned + installed rows into the DTO. */
	async list(): Promise<PluginInfo[]> {
		const rows = await this.db.db.select().from(plugins);
		const byId = new Map(rows.map((r) => [r.id, r]));
		const activeAdapters = this.activeAdapterIds();
		const out: PluginInfo[] = [];
		const codeManifests = [
			...ALL_PLUGIN_MANIFESTS,
			// v1.8.0 — official connectors provisioned from the GitHub registry
			// resolve (and toggle) exactly like built-ins.
			...this.registry
				.registeredRows()
				.map((r) => this.registry.registeredManifest(r.id))
				.filter((m): m is AdapterManifest => m !== null),
		];
		for (const m of codeManifests) {
			const enabled = byId.get(m.id)?.enabled ?? m.enabledByDefault !== false;
			out.push(
				await this.toInfo(
					m,
					enabled,
					byId.get(m.id)?.configuration,
					activeAdapters,
				),
			);
		}
		const installedRows = this.db.db.select().from(installedPlugins).all();
		for (const row of installedRows) {
			out.push(this.installedToInfo(row, activeAdapters));
		}
		return out;
	}

	/**
	 * Adapter ids that at least one ENABLED source currently uses. Derived, never
	 * stored (R-A09) — the plugin DTO's `active` flag comes from this set, so the
	 * Plugins page can show "in use" without a duplicated source-of-truth.
	 */
	private activeAdapterIds(): Set<string> {
		const rows = this.db.rawDb
			.prepare("SELECT adapter FROM sources WHERE enabled = 1")
			.all() as Array<{ adapter: string }>;
		return new Set(rows.map((r) => r.adapter));
	}

	/**
	 * Enable/disable a plugin or update its persisted configuration. Disabling
	 * an adapter (core or not) only pauses its sources at crawl time — source
	 * rows are never touched, so re-enabling restores the previous state.
	 * Configuration merges shallowly into the plugin's `configuration` JSON —
	 * UI plugins persist their settings here. Works for built-in AND installed
	 * plugins (each persists into its own table).
	 */
	async update(id: string, input: UpdatePluginInput): Promise<PluginInfo> {
		const manifest = this.manifest(id);
		const installed = manifest ? undefined : this.installedRow(id);
		if (!manifest && !installed) {
			throw new NotFoundException(`plugin ${id} not found`);
		}
		const activeAdapters = this.activeAdapterIds();

		if (manifest) {
			// Locked plugins are always on — the app itself depends on them
			// (the Icon Pack powers the app's icons and fonts). Refuse disabling.
			if (manifest.locked && input.enabled === false) {
				throw new ConflictException({
					code: "PLUGIN_LOCKED",
					message: `${id} is always on and cannot be disabled.`,
				});
			}

			const [row] = await this.db.db
				.select()
				.from(plugins)
				.where(eq(plugins.id, id))
				.limit(1);

			const patch: Record<string, unknown> = {};
			if (input.enabled !== undefined) patch.enabled = input.enabled;
			if (input.configuration !== undefined) {
				// Shallow merge so UI plugins can flip one setting without clobbering
				// the rest of their persisted config.
				patch.configuration = {
					...(row?.configuration ?? {}),
					...input.configuration,
				};
			}
			if (Object.keys(patch).length > 0) {
				await this.db.db.update(plugins).set(patch).where(eq(plugins.id, id));
			}

			const [after] = await this.db.db
				.select()
				.from(plugins)
				.where(eq(plugins.id, id))
				.limit(1);
			return this.toInfo(
				manifest,
				after?.enabled ?? manifest.enabledByDefault !== false,
				after?.configuration,
				activeAdapters,
			);
		}

		// Installed plugin path.
		const patch: Record<string, unknown> = {};
		if (input.enabled !== undefined) patch.enabled = input.enabled;
		if (input.configuration !== undefined) {
			patch.configuration = {
				...(installed?.configuration ?? {}),
				...input.configuration,
			};
		}
		if (Object.keys(patch).length > 0) {
			this.db.db
				.update(installedPlugins)
				.set(patch)
				.where(eq(installedPlugins.id, id))
				.run();
		}
		const after = this.installedRow(id);
		if (!after) throw new NotFoundException(`plugin ${id} not found`);
		return this.installedToInfo(after, activeAdapters);
	}

	/** Backward-compatible alias for the crawler's enable/disable call sites. */
	async setEnabled(id: string, input: UpdatePluginInput): Promise<PluginInfo> {
		return this.update(id, input);
	}

	/**
	 * Effective enable state for the crawler: the plugin itself AND every
	 * dependency must be enabled (dependency cascade — built-ins currently have
	 * no deps, but the model is in place for future plugins). Installed plugins
	 * are UI-only and never gate the crawler.
	 */
	async isEnabled(adapter: string): Promise<boolean> {
		const manifest = this.manifest(adapter);
		if (!manifest) return false; // unknown adapter = never enabled
		// Locked plugins are always on (the app depends on them).
		if (manifest.locked) return true;
		const rows = await this.db.db
			.select({ enabled: plugins.enabled })
			.from(plugins)
			.where(eq(plugins.id, adapter))
			.limit(1);
		const selfEnabled = rows[0]?.enabled ?? manifest.enabledByDefault !== false;
		if (!selfEnabled) return false;
		return this.dependenciesEnabled(manifest.dependencies ?? []);
	}

	/**
	 * Read a plugin's persisted configuration (for the desktop's usePluginConfig
	 * hook). Returns the stored object, or null when the plugin is unknown.
	 */
	async getConfiguration(id: string): Promise<Record<string, unknown> | null> {
		const manifest = this.manifest(id);
		if (manifest) {
			const [row] = await this.db.db
				.select({ configuration: plugins.configuration })
				.from(plugins)
				.where(eq(plugins.id, id))
				.limit(1);
			return (row?.configuration ?? {}) as Record<string, unknown>;
		}
		const installed = this.installedRow(id);
		return installed ? (installed.configuration ?? {}) : null;
	}

	/**
	 * Resolve the adapter name for a source type (replaces the old
	 * `defaultAdapterFor` that always returned "rss"). Considers built-ins AND
	 * official connectors provisioned from the registry. Unknown types throw —
	 * SourcesService surfaces that as a validation error on create (after
	 * trying to auto-provision the connector from the GitHub registry).
	 */
	adapterFor(type: SourceType): string {
		const manifest =
			manifestForType(type) ?? this.registry.registeredForType(type);
		if (!manifest) {
			throw new Error(`no adapter registered for source type '${type}'`);
		}
		return manifest.id;
	}

	/**
	 * Lightweight required-field validation against a plugin's config schema.
	 * Returns a human-readable error, or null when the config is acceptable.
	 * Dotted keys ("crawl.url") are resolved into the nested configuration.
	 * Installed plugins have no configFields (UI-only) — always valid.
	 */
	validateConfig(
		adapter: string,
		config: Record<string, unknown>,
	): string | null {
		const manifest = this.manifest(adapter);
		if (!manifest) return `no adapter '${adapter}'`;
		for (const f of manifest.configFields) {
			if (!f.required) continue;
			const value = readDotted(config, f.key);
			if (value === undefined || value === null || value === "") {
				return `missing required field: ${f.label}`;
			}
		}
		return null;
	}

	/**
	 * Uninstall a user-installed plugin: refuse built-ins (they can only be
	 * disabled), refuse when sources still reference this plugin as their
	 * adapter unless `force=true` (R-A10 — user-owned data must not vanish
	 * silently), then delete the DB row + the on-disk folder.
	 */
	uninstall(id: string, force = false): void {
		if (this.manifest(id)) {
			throw new ConflictException({
				code: "PLUGIN_IS_CORE",
				message: `${id} is a built-in plugin and cannot be uninstalled. Disable it instead.`,
			});
		}
		const installed = this.installedRow(id);
		if (!installed) throw new NotFoundException(`plugin ${id} not found`);

		// Defensive — installed plugins are UI-only, but never delete rows that
		// sources depend on without an explicit force (R-A10).
		const { c } = this.db.rawDb
			.prepare("SELECT COUNT(*) AS c FROM sources WHERE adapter = ?")
			.get(id) as { c: number };
		if (c > 0 && !force) {
			throw new ConflictException({
				code: "SOURCES_REFERENCE_PLUGIN",
				sourceCount: c,
				message: `${c} source(s) use this plugin. Uninstall anyway?`,
			});
		}

		this.db.db
			.delete(installedPlugins)
			.where(eq(installedPlugins.id, id))
			.run();
		const dir = join(resolvePluginsDir(), installed.bundlePath);
		rmSync(dir, { recursive: true, force: true });
		this.logger.log(`plugin ${id} uninstalled`);
	}

	/** Read an installed plugin's bundle for GET /plugins/:id/bundle. */
	readBundle(id: string): Buffer {
		const installed = this.installedRow(id);
		if (!installed) throw new NotFoundException(`plugin ${id} not found`);
		const file = join(resolvePluginsDir(), installed.bundlePath, "bundle.js");
		if (!existsSync(file))
			throw new NotFoundException(`plugin ${id} bundle not found`);
		return readFileSync(file);
	}

	/**
	 * Read a packaged asset (v1.8.0 — custom image icons) for
	 * GET /plugins/:id/assets/:file. Path-traversal guarded: the resolved path
	 * must stay inside the plugin's own folder. Local-only — serves whatever
	 * the package extracted (e.g. `assets/icon.png`), never a remote fetch.
	 */
	readAsset(id: string, file: string): Buffer {
		if (!file || file.includes("\\") || file.startsWith("/")) {
			throw new BadRequestException("invalid asset path");
		}
		const installed = this.installedRow(id);
		if (!installed) throw new NotFoundException(`plugin ${id} not found`);
		const base = resolve(resolvePluginsDir(), installed.bundlePath);
		const target = resolve(base, file);
		if (target !== base && !target.startsWith(base + sep)) {
			throw new BadRequestException("invalid asset path");
		}
		if (!existsSync(target) || statSync(target).isDirectory()) {
			throw new NotFoundException(`plugin ${id} asset ${file} not found`);
		}
		return readFileSync(target);
	}

	/** The `data/plugins/` path users drop plugin folders into. */
	pluginsDir(): { dir: string } {
		return { dir: resolvePluginsDir() };
	}

	/**
	 * Install a `.vorynth-plugin` package (a ZIP holding `plugin.json` +
	 * `bundle.js`, built by `scripts/package-plugin.mjs`). This is the
	 * non-technical install path: the desktop's "Install plugin" button uploads
	 * the file here; power users can still drop folders + Scan.
	 *
	 * Validation: the archive must unzip, contain `plugin.json` (id/name/version)
	 * and `bundle.js` at the root, and the id must not collide with a built-in
	 * plugin. Entry names are sanitized (zip-slip guard) before anything touches
	 * disk. Re-installing an existing plugin updates its manifest fields while
	 * keeping the user's enabled/configuration state.
	 */
	async installPackage(
		data: Buffer,
	): Promise<PluginInfo & { installed: true }> {
		let entries: Record<string, Uint8Array>;
		try {
			entries = unzipSync(new Uint8Array(data));
		} catch {
			throw new BadRequestException({
				code: "PLUGIN_INVALID_PACKAGE",
				message: "This isn't a valid .vorynth-plugin package.",
			});
		}

		// Decompression-bomb guard — the request body is capped (4MB) but the
		// unzipped payload is not, so bound what we're willing to write.
		const totalBytes = Object.values(entries).reduce(
			(sum, e) => sum + e.byteLength,
			0,
		);
		if (totalBytes > MAX_INSTALLED_PACKAGE_BYTES) {
			throw new BadRequestException({
				code: "PLUGIN_PACKAGE_TOO_LARGE",
				message: "The plugin package is too large to install.",
			});
		}

		const manifestRaw = entries["plugin.json"];
		const bundle = entries["bundle.js"];
		if (!manifestRaw || !bundle) {
			throw new BadRequestException({
				code: "PLUGIN_INVALID_PACKAGE",
				message:
					"A .vorynth-plugin package needs a plugin.json manifest and a bundle.js.",
			});
		}

		let manifest: InstalledPluginManifest;
		try {
			const parsed = JSON.parse(
				strFromU8(manifestRaw),
			) as InstalledPluginManifest;
			if (
				typeof parsed?.id !== "string" ||
				parsed.id.length === 0 ||
				typeof parsed.name !== "string" ||
				typeof parsed.version !== "string"
			) {
				throw new Error("bad manifest");
			}
			manifest = parsed;
		} catch {
			throw new BadRequestException({
				code: "PLUGIN_INVALID_MANIFEST",
				message:
					"plugin.json is missing or malformed — it needs id, name, and version.",
			});
		}

		if (this.manifest(manifest.id)) {
			throw new ConflictException({
				code: "PLUGIN_IS_CORE",
				message: `${manifest.id} is a built-in plugin and can't be reinstalled as a package.`,
			});
		}

		// Zip-slip guard: write only safe, relative entry names under the
		// plugin's own directory.
		const dir = join(resolvePluginsDir(), manifest.id);
		const safeEntries = Object.entries(entries).filter(([name]) =>
			isSafePackageEntry(name),
		);
		mkdirSync(dir, { recursive: true });
		for (const [name, bytes] of safeEntries) {
			const target = resolve(dir, name);
			if (target !== dir && !target.startsWith(resolve(dir) + sep)) continue;
			mkdirSync(join(target, ".."), { recursive: true });
			writeFileSync(target, bytes);
		}
		this.logger.log(`plugin ${manifest.id} installed from package`);

		// Register the row (or refresh it on reinstall — enabled/config survive).
		const existing = this.installedRow(manifest.id);
		if (existing) {
			this.db.db
				.update(installedPlugins)
				.set({
					name: manifest.name,
					description: manifest.description ?? existing.description,
					version: manifest.version,
					contributions: manifest.contributions ?? [],
				})
				.where(eq(installedPlugins.id, manifest.id))
				.run();
		} else {
			this.ensureInstalledRow(manifest, manifest.id);
		}
		// Static security scan of the freshly written bundle (row now exists).
		this.scanAndPersist(manifest.id, join(dir, "bundle.js"));
		const row = this.installedRow(manifest.id);
		if (!row)
			throw new ConflictException(`plugin ${manifest.id} install failed`);
		return this.installedToInfo(row);
	}

	private async toInfo(
		m: AdapterManifest,
		enabled: boolean,
		configuration?: Record<string, unknown> | null,
		activeAdapters: ReadonlySet<string> = new Set(),
	): Promise<PluginInfo> {
		return {
			id: m.id,
			name: m.name,
			description: m.description,
			version: m.version,
			kind: m.kind,
			type: m.type,
			adapter: m.id,
			...(m.icon ? { icon: m.icon } : {}),
			...(m.iconSrc ? { iconSrc: m.iconSrc } : {}),
			...(m.tier ? { tier: m.tier } : {}),
			core: m.core === true,
			// Locked plugins always report enabled — the app depends on them.
			locked: m.locked === true,
			enabled: m.locked === true ? true : enabled,
			effectiveEnabled:
				m.locked === true
					? true
					: enabled
						? await this.dependenciesEnabled(m.dependencies ?? [])
						: false,
			dependencies: m.dependencies ?? [],
			configFields: m.configFields,
			active: activeAdapters.has(m.id),
			...(m.contributions && m.contributions.length > 0
				? { contributions: m.contributions }
				: {}),
			...(configuration && Object.keys(configuration).length > 0
				? { configuration }
				: {}),
		};
	}

	/** Map an installed-plugins row to the public DTO (UI-only, no deps). */
	private installedToInfo(
		row: InstalledPluginRow,
		activeAdapters: ReadonlySet<string> = new Set(),
	): PluginInfo & { installed: true } {
		return {
			id: row.id,
			name: row.name,
			description: row.description,
			version: row.version,
			kind: "ui",
			type: row.type,
			adapter: row.id,
			core: false,
			// Installed packages are community by default (v1.8.0); a promotion to
			// official is a future registry/persistence concern.
			tier: "community",
			enabled: row.enabled,
			effectiveEnabled: row.enabled,
			active: activeAdapters.has(row.id),
			dependencies: [],
			configFields: [],
			installed: true,
			...(row.contributions && row.contributions.length > 0
				? { contributions: row.contributions }
				: {}),
			...(row.configuration && Object.keys(row.configuration).length > 0
				? { configuration: row.configuration }
				: {}),
			...(row.securityScan ? { security: row.securityScan } : {}),
		};
	}

	private async dependenciesEnabled(deps: string[]): Promise<boolean> {
		for (const dep of deps) {
			const rows = await this.db.db
				.select({ enabled: plugins.enabled })
				.from(plugins)
				.where(eq(plugins.id, dep))
				.limit(1);
			const depManifest = this.manifest(dep);
			const depEnabled =
				rows[0]?.enabled ?? depManifest?.enabledByDefault !== false;
			if (!depEnabled) return false;
		}
		return true;
	}
}

/** Resolve a dotted key ("crawl.url") through a nested object. */
function readDotted(config: Record<string, unknown>, dotted: string): unknown {
	let cur: unknown = config;
	for (const part of dotted.split(".")) {
		if (cur === null || typeof cur !== "object") return undefined;
		cur = (cur as Record<string, unknown>)[part];
	}
	return cur;
}

/**
 * Upper bound on a `.vorynth-plugin` archive's UNCOMPRESSED size. The HTTP
 * body cap (4MB) bounds the zip itself; this bounds what a malicious/accidental
 * zip bomb could expand to before anything is written to disk.
 */
const MAX_INSTALLED_PACKAGE_BYTES = 32 * 1024 * 1024;

/**
 * Zip-slip guard for package entries. Only plain relative names survive:
 * no absolute paths, no ".."/"." segments, no empty segments, no drive
 * letters. The caller additionally verifies every write stays inside the
 * plugin's own directory.
 */
function isSafePackageEntry(name: string): boolean {
	if (typeof name !== "string" || name.length === 0) return false;
	const normalized = name.replace(/\\/g, "/");
	if (normalized.startsWith("/") || /^[a-zA-Z]:/.test(normalized)) return false;
	const parts = normalized.split("/");
	return !parts.some((p) => p === "" || p === "." || p === "..");
}
