import {
	BadRequestException,
	ConflictException,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
	Optional,
	ServiceUnavailableException,
} from "@nestjs/common";
import { and, asc, count, eq, sql } from "drizzle-orm";
import { DatabaseService } from "../../db/database.service.js";
import { sourceLists, sources, type SourceListRow } from "../../db/schema.js";
import { ftsRebuildIndex } from "../../db/fts-sync.js";
import { sweepOrphanSpines } from "../../db/spine.js";
import { PluginsService } from "../plugins/plugins.service.js";
import type {
	RefreshCatalogResult,
	SourceListInfo,
	SourceListOrigin,
	SourceListSourceDefinition,
	SourceListSourcePreview,
} from "@vorynth/types";
import { SOURCE_AUTHORITIES, SOURCE_SCOPES } from "@vorynth/types";

/**
 * Text fetcher used by the community catalog refresh. The real implementation
 * hits GitHub; tests inject a stub so `refreshCatalog` runs fully offline.
 */
export interface CatalogFetcher {
	getText(url: string): Promise<string | null>;
}

/** Community list file ids and source ids must be URL-safe slugs. */
const ID_RE = /^[a-z0-9][a-z0-9-]*$/;

const DEFAULT_REPO = "omidnw/vorynth";
const DEFAULT_REPO_REF = "master";
const DEFAULT_RAW_BASE = "https://raw.githubusercontent.com";

/**
 * Curated source lists (v1.8.0).
 *
 * Official lists seed in-app code (trusted); community lists are contributed
 * through the GitHub repo (JSON files under the sources/ folder, flexible
 * layout — flat files or per-author folders) and downloaded once into
 * `source_lists.sources_json`:
 * the cached catalog works fully offline and a failed refresh never clears it.
 *
 * `enabled` is the master switch: turning a list off hides its sources from
 * the page AND the crawler, but rows are kept — re-enabling restores them with
 * every user edit intact (R-A10). The NSFW flag is stored/returned here; the
 * 18+ gate is UI-side (badge + confirm, hidden by default per
 * `sourceLists.hideAdult`).
 */
@Injectable()
export class SourceListsService {
	private readonly logger = new Logger("SourceLists");
	private readonly repo: string;
	private readonly repoRef: string;
	private readonly rawBase: string;
	private readonly fetchText: (url: string) => Promise<string | null>;

	constructor(
		@Inject(DatabaseService) private readonly db: DatabaseService,
		@Inject(PluginsService) private readonly plugins: PluginsService,
		@Optional() fetcher?: CatalogFetcher,
	) {
		this.repo = process.env.VORYNTH_SOURCES_REPO ?? DEFAULT_REPO;
		this.repoRef = process.env.VORYNTH_SOURCES_REPO_REF ?? DEFAULT_REPO_REF;
		this.rawBase = process.env.VORYNTH_SOURCES_RAW_BASE ?? DEFAULT_RAW_BASE;
		// The default fetcher hits the network; tests inject a stub (offline).
		this.fetchText = fetcher ? (url) => fetcher.getText(url) : defaultFetch;
	}

	/** Every curated list, with its live source/enabled counts. Deleted lists
	 * are gone for good — they never come back here (v1.8.1). */
	async list(): Promise<SourceListInfo[]> {
		const rows = await this.db.db
			.select({
				list: sourceLists,
				sourceCount: count(sources.id).mapWith(Number),
				enabledCount: sql<number>`COALESCE(SUM(CASE WHEN ${sources.enabled} = 1 THEN 1 ELSE 0 END), 0)`,
			})
			.from(sourceLists)
			.leftJoin(sources, eq(sources.listId, sourceLists.id))
			.where(eq(sourceLists.deleted, false))
			.groupBy(sourceLists.id)
			.orderBy(asc(sourceLists.createdAt));
		// v1.8.1 — the SQL join only counts MATERIALIZED rows; a community list
		// that hasn't been enabled yet has none (its definitions live in
		// sources_json), so it used to show "0 sources". The definition count
		// is the real size.
		return rows.map((r) =>
			toListInfo(
				r.list,
				effectiveSourceCount(r.list.sourcesJson, r.sourceCount),
				r.enabledCount,
			),
		);
	}

	async get(id: string): Promise<SourceListInfo> {
		const rows = await this.db.db
			.select({
				list: sourceLists,
				sourceCount: count(sources.id).mapWith(Number),
				enabledCount: sql<number>`COALESCE(SUM(CASE WHEN ${sources.enabled} = 1 THEN 1 ELSE 0 END), 0)`,
			})
			.from(sourceLists)
			.leftJoin(sources, eq(sources.listId, sourceLists.id))
			.where(and(eq(sourceLists.id, id), eq(sourceLists.deleted, false)))
			.groupBy(sourceLists.id)
			.limit(1);
		const row = rows[0];
		if (!row) throw new NotFoundException(`source list ${id} not found`);
		return toListInfo(
			row.list,
			effectiveSourceCount(row.list.sourcesJson, row.sourceCount),
			row.enabledCount,
		);
	}

	/**
	 * The list's sites for the preview modal (v1.8.1) — from its cached
	 * definitions, so it works whether or not the list has been enabled
	 * (materialized). Each entry is merged with the materialized row's
	 * `enabled` state when one exists.
	 */
	async sources(id: string): Promise<SourceListSourcePreview[]> {
		const row = await this.db.db
			.select()
			.from(sourceLists)
			.where(and(eq(sourceLists.id, id), eq(sourceLists.deleted, false)))
			.get();
		if (!row) throw new NotFoundException(`source list ${id} not found`);
		const defs = (row.sourcesJson ?? []) as SourceListSourceDefinition[];
		const rows = await this.db.db
			.select({ id: sources.id, enabled: sources.enabled })
			.from(sources)
			.where(eq(sources.listId, id));
		const enabledById = new Map(rows.map((r) => [r.id, r.enabled]));
		return defs.map((d) => ({
			id: d.id,
			name: d.name,
			url: d.url,
			category: d.category,
			adapter: d.adapter,
			enabled: enabledById.get(d.id) ?? false,
		}));
	}

	/**
	 * Turn a list on: materialize its cached definitions as real `sources`
	 * rows (INSERT OR IGNORE by fixed id — user edits are never overwritten),
	 * then flip the master switch. Idempotent — re-enabling after a disable
	 * restores the exact pre-disable state.
	 */
	async enable(id: string): Promise<SourceListInfo> {
		// Fetch the raw row — the materialization needs the cached definitions
		// (sources_json), which the public SourceListInfo deliberately omits.
		// Deleted lists can't be re-enabled (v1.8.1).
		const [row] = await this.db.db
			.select()
			.from(sourceLists)
			.where(and(eq(sourceLists.id, id), eq(sourceLists.deleted, false)))
			.limit(1);
		if (!row) throw new NotFoundException(`source list ${id} not found`);
		const defs = (row.sourcesJson ?? []) as unknown[];
		const values = defs
			.map((d) => {
				const def = this.parseSourceDef(d, row.id);
				if (!def) return undefined;
				return {
					id: def.id,
					name: def.name,
					url: def.url,
					type: def.type,
					category: def.category,
					adapter: def.adapter,
					configuration: def.configuration,
					enabled: true,
					fetchWindowDays: def.fetchWindowDays ?? 7,
					listId: row.id,
					country: def.country ?? null,
					city: def.city ?? null,
					language: def.language ?? null,
					scope: def.scope ?? null,
					authority: def.authority ?? null,
					impactAreas: def.impactAreas ?? null,
				};
			})
			.filter((v): v is NonNullable<typeof v> => v !== undefined);
		if (values.length > 0) {
			await this.db.db.insert(sources).values(values).onConflictDoNothing();
		}
		await this.db.db
			.update(sourceLists)
			.set({ enabled: true })
			.where(eq(sourceLists.id, id));
		return this.get(id);
	}

	/**
	 * Import a source-list file (v1.8.0) — any `my-sources.json` exported from
	 * the app, or a community-list file from the repo. It is validated with the
	 * exact same gate as catalog files (shape-checked, adapter registered,
	 * config validated — R-A06), stored as a LOCAL list (`origin: "import"`),
	 * and returned so the UI can enable it. Id collisions (a community list
	 * with the same id) are resolved by suffixing until free.
	 */
	async importListFile(text: string): Promise<SourceListInfo> {
		let raw: unknown;
		try {
			raw = JSON.parse(text);
		} catch {
			throw new BadRequestException("sourceList.importInvalidJson");
		}
		if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
			throw new BadRequestException("sourceList.importInvalidJson");
		}
		const parsed = this.parseListFile(raw as Record<string, unknown>, "import");
		if (!parsed) {
			throw new BadRequestException("sourceList.importInvalid");
		}

		let id = parsed.id;
		let suffix = 1;
		while (
			(
				await this.db.db
					.select({ id: sourceLists.id })
					.from(sourceLists)
					.where(eq(sourceLists.id, id))
					.limit(1)
			).length > 0
		) {
			id = `${parsed.id}-${suffix++}`;
		}

		await this.db.db.insert(sourceLists).values({
			id,
			name: parsed.name,
			description: parsed.description,
			origin: "import",
			nsfw: parsed.nsfw,
			enabled: false,
			version: parsed.version ?? undefined,
			sourcesJson: parsed.sources,
			curator: parsed.curator ?? undefined,
			updatedAt: new Date(),
		});
		this.logger.log(
			`imported source list "${parsed.name}" (${parsed.sources.length} sources) as ${id}`,
		);
		return this.get(id);
	}

	/**
	 * Hide a list. Nothing is deleted — sources and their edits are preserved,
	 * the crawler just stops collecting them (the UI hides them too). The list
	 * can be re-added any time with `enable`.
	 */
	async disable(id: string): Promise<SourceListInfo> {
		await this.get(id);
		await this.db.db
			.update(sourceLists)
			.set({ enabled: false })
			.where(eq(sourceLists.id, id));
		return this.get(id);
	}

	/**
	 * Permanently delete a list (v1.8.1) — official or community, enabled or
	 * not. Unlike `disable`, this is a tombstone: the row is marked `deleted`
	 * (so seeds and catalog refreshes never restore it) and the list's
	 * materialized sources are removed. The engine REFUSES
	 * (409 BOOKMARKED_ARTICLES_EXIST) when the list's sources own saved
	 * stories — `force` confirms the explicit "Delete anyway" flow.
	 *
	 * Articles cascade with their sources (FK); orphan spines and bookmarks
	 * referencing them are swept in the same atomic step (SourcesService
	 * pattern). FTS entries are rebuilt so search space is reclaimed.
	 */
	async remove(id: string, force = false): Promise<void> {
		const raw = this.db.rawDb;
		const { c: bookmarkedCount } = raw
			.prepare(
				`SELECT COUNT(*) AS c FROM articles a
				 JOIN bookmarks b ON b.content_item_id = a.content_item_id
				 JOIN sources s ON s.id = a.source_id
				 WHERE s.list_id = ?`,
			)
			.get(id) as { c: number };

		if (bookmarkedCount > 0 && !force) {
			throw new ConflictException({
				code: "BOOKMARKED_ARTICLES_EXIST",
				bookmarkedCount,
				message: `${bookmarkedCount} saved storie(s) belong to this list. Delete anyway?`,
			});
		}

		// Existence check — also makes a repeat delete a clean 404.
		await this.get(id);

		raw.transaction(() => {
			// NOTE: the transaction function must be invoked (`})()`) or nothing runs.
			raw
				.prepare(
					"UPDATE source_lists SET deleted = 1, enabled = 0 WHERE id = ?",
				)
				.run(id);
			raw.prepare("DELETE FROM sources WHERE list_id = ?").run(id);
			// Drop the spines the cascaded articles leave behind (bookmarks
			// referencing them cascade too). Only touches spines with no
			// origin — invariant-preserving and idempotent.
			sweepOrphanSpines(raw);
		})();

		// Stale FTS5 entries (from cascade-deleted articles) are invisible
		// in search results because the query INNER JOINs articles. Rebuild
		// the index to reclaim space from stale entries.
		ftsRebuildIndex(this.db.rawDb);
	}

	/**
	 * The ids of lists whose master switch is on — the crawler's gate. A
	 * source with `listId` is only collected when its list is enabled.
	 */
	async getEnabledListIds(): Promise<Set<string>> {
		const rows = await this.db.db
			.select({ id: sourceLists.id })
			.from(sourceLists)
			.where(
				and(eq(sourceLists.enabled, true), eq(sourceLists.deleted, false)),
			);
		return new Set(rows.map((r) => r.id));
	}

	/**
	 * Sync the community catalog from the GitHub repo (JSON files under the
	 * sources/ folder, discovered via the trees API so the layout stays
	 * flexible — flat files or per-author/curator folders).
	 *
	 * Rules:
	 * - every list file is validated (id/name shape + every source's adapter
	 *   must be registered AND its config must validate) — invalid entries are
	 *   skipped with a log line, never stored;
	 * - an upsert PRESERVES the user's `enabled` state — only definitions
	 *   refresh; new lists start hidden (opt-in, and NSFW lists confirm);
	 * - a failed fetch never clears the cache: the stored rows ARE the offline
	 *   catalog. A reachability failure throws (the UI surfaces it), leaving
	 *   everything intact.
	 */
	async refreshCatalog(): Promise<RefreshCatalogResult> {
		const result: RefreshCatalogResult = {
			added: [],
			updated: [],
			removed: [],
			unchanged: [],
			skipped: [],
		};

		const treeUrl = `https://api.github.com/repos/${this.repo}/git/trees/${encodeURIComponent(this.repoRef)}?recursive=1`;
		const treeText = await this.fetchText(treeUrl);
		if (!treeText) {
			throw new ServiceUnavailableException({
				code: "CATALOG_UNREACHABLE",
				message: `Could not reach the community sources catalog (${this.repo}). Your saved lists are unchanged.`,
			});
		}

		let paths: string[];
		try {
			const tree = JSON.parse(treeText) as {
				tree?: Array<{ path?: string; type?: string }>;
			};
			paths = (tree.tree ?? [])
				.filter((e) => e.type === "blob")
				.map((e) => e.path ?? "")
				.filter((p) => p.startsWith("sources/") && p.endsWith(".json"));
		} catch {
			throw new ServiceUnavailableException({
				code: "CATALOG_INVALID",
				message: "The community catalog response was not valid JSON.",
			});
		}

		// Load ALL lists (official + community): the official-collision guard
		// below only works if official rows are in the map.
		const existingRows = await this.db.db.select().from(sourceLists);
		const existingById = new Map(existingRows.map((r) => [r.id, r]));
		const seen = new Set<string>();

		for (const path of paths) {
			const rawUrl = `${this.rawBase}/${this.repo}/${this.repoRef}/${path}`;
			const body = await this.fetchText(rawUrl);
			if (!body) {
				result.skipped.push(path);
				this.logger.warn(`catalog: could not fetch ${path}`);
				continue;
			}
			let parsed: Record<string, unknown>;
			try {
				parsed = JSON.parse(body) as Record<string, unknown>;
			} catch {
				result.skipped.push(path);
				this.logger.warn(`catalog: ${path} is not valid JSON`);
				continue;
			}

			const def = this.parseListFile(parsed, path);
			if (!def) {
				result.skipped.push(path);
				continue;
			}

			// An official list with the same id can't be overridden by the catalog.
			const existing = existingById.get(def.id);
			if (existing && existing.origin === "official") {
				result.skipped.push(path);
				this.logger.warn(
					`catalog: ${path} collides with official list '${def.id}' — ignored`,
				);
				continue;
			}
			// A list the user deleted stays deleted (v1.8.1) — a refresh never
			// resurrects it; the row just stops receiving updates.
			if (existing && existing.deleted) {
				seen.add(def.id);
				continue;
			}

			seen.add(def.id);
			if (existing) {
				const same =
					existing.name === def.name &&
					existing.description === def.description &&
					existing.nsfw === def.nsfw &&
					existing.version === def.version &&
					JSON.stringify(existing.sourcesJson) === JSON.stringify(def.sources);
				if (same) {
					result.unchanged.push(def.id);
				} else {
					// Preserve `enabled` — the user's choice survives a refresh.
					await this.db.db
						.update(sourceLists)
						.set({
							name: def.name,
							description: def.description,
							nsfw: def.nsfw,
							version: def.version,
							curator: def.curator,
							sourcesJson: def.sources,
							// v1.8.1 — remember where the file lives so the
							// per-list "Update" button can fetch it directly.
							repoPath: path,
							updatedAt: new Date(),
						})
						.where(eq(sourceLists.id, existing.id));
					result.updated.push(def.id);
				}
			} else {
				// New community lists start hidden — the user opts in explicitly
				// (and NSFW lists go through the 18+ confirmation).
				await this.db.db.insert(sourceLists).values({
					id: def.id,
					name: def.name,
					description: def.description,
					origin: "community",
					nsfw: def.nsfw,
					enabled: false,
					version: def.version,
					curator: def.curator,
					sourcesJson: def.sources,
					repoPath: path,
					createdAt: new Date(),
				});
				result.added.push(def.id);
			}
		}

		// Lists whose file left the repo stay cached (offline-usable, R-A10) —
		// they just stop receiving updates. Report them so the UI can say so.
		// Official lists are never "removed" — they live in code, not the repo.
		for (const row of existingRows) {
			if (row.origin === "official") continue;
			if (!seen.has(row.id)) result.removed.push(row.id);
		}

		this.logger.log(
			`community catalog refresh: +${result.added.length} ~${result.updated.length} -${result.removed.length} =${result.unchanged.length} (${result.skipped.length} skipped)`,
		);
		return result;
	}

	/**
	 * Update ONE downloaded community list from its repo file (v1.8.1) — the
	 * per-list "Update" button. Fetches the file the list was downloaded from,
	 * validates it with the same gate as a refresh, and applies the new
	 * definitions when they differ — PRESERVING the user's `enabled` choice
	 * and never duplicating sources (R-A10). When the list is enabled, new
	 * sources materialize via the same idempotent insert as `enable`.
	 *
	 * Returns `{ updated, info }` so the UI can say "Updated" vs "Up to date".
	 */
	async updateFromRepo(
		id: string,
	): Promise<{ updated: boolean; info: SourceListInfo }> {
		const row = await this.db.db
			.select()
			.from(sourceLists)
			.where(and(eq(sourceLists.id, id), eq(sourceLists.deleted, false)))
			.get();
		if (!row) throw new NotFoundException(`source list ${id} not found`);
		if (!row.repoPath) {
			throw new BadRequestException("sourceList.noRepoPath");
		}

		const rawUrl = `${this.rawBase}/${this.repo}/${this.repoRef}/${row.repoPath}`;
		const body = await this.fetchText(rawUrl);
		if (!body) {
			throw new ServiceUnavailableException({
				code: "CATALOG_UNREACHABLE",
				message: `Could not reach the community catalog to update "${row.name}". Your saved list is unchanged.`,
			});
		}
		let parsed: Record<string, unknown>;
		try {
			parsed = JSON.parse(body) as Record<string, unknown>;
		} catch {
			throw new BadRequestException("sourceList.importInvalidJson");
		}
		const def = this.parseListFile(parsed, row.repoPath);
		if (!def) {
			throw new BadRequestException("sourceList.importInvalid");
		}

		const same =
			row.name === def.name &&
			row.description === def.description &&
			row.nsfw === def.nsfw &&
			row.version === def.version &&
			JSON.stringify(row.sourcesJson) === JSON.stringify(def.sources);
		if (same) {
			return { updated: false, info: await this.get(id) };
		}

		await this.db.db
			.update(sourceLists)
			.set({
				name: def.name,
				description: def.description,
				nsfw: def.nsfw,
				version: def.version,
				curator: def.curator,
				sourcesJson: def.sources,
				updatedAt: new Date(),
			})
			.where(eq(sourceLists.id, id));
		this.logger.log(
			`updated community list "${def.name}" from ${row.repoPath} (${def.sources.length} sources)`,
		);

		// An enabled list materializes its (possibly new) sources the same
		// idempotent way `enable` does — INSERT OR IGNORE, never duplicates.
		if (row.enabled) await this.enable(id);

		return { updated: true, info: await this.get(id) };
	}

	// ── catalog parsing + validation ────────────────────────────────────────
	// Community data is untrusted (R-A06): every field is shape-checked and
	// every source definition must reference a registered adapter whose config
	// validates — the same gate SourcesService applies on create.

	private parseListFile(
		raw: Record<string, unknown>,
		path: string,
	): ParsedListFile | null {
		const id = typeof raw.id === "string" ? raw.id.trim() : "";
		if (!ID_RE.test(id)) {
			this.logger.warn(`catalog: ${path} has no valid id — skipped`);
			return null;
		}
		const name = typeof raw.name === "string" ? raw.name.trim() : "";
		if (!name) {
			this.logger.warn(`catalog: ${path} has no name — skipped`);
			return null;
		}
		const description =
			typeof raw.description === "string" ? raw.description : "";
		const nsfw = raw.nsfw === true;
		const version = typeof raw.version === "string" ? raw.version : null;

		const rawSources = Array.isArray(raw.sources) ? raw.sources : [];
		const sources: SourceListSourceDefinition[] = [];
		let dropped = 0;
		for (const s of rawSources) {
			const def = this.parseSourceDef(s, path);
			if (def) sources.push(def);
			else dropped += 1;
		}
		if (dropped > 0) {
			this.logger.warn(
				`catalog: ${path} — dropped ${dropped} invalid source(s)`,
			);
		}
		if (sources.length === 0) {
			this.logger.warn(`catalog: ${path} defines no usable sources — skipped`);
			return null;
		}
		return {
			id,
			name,
			description,
			nsfw,
			version,
			curator: curatorFor(path),
			sources,
		};
	}

	private parseSourceDef(
		raw: unknown,
		_context: string,
	): SourceListSourceDefinition | null {
		if (typeof raw !== "object" || raw === null) return null;
		const r = raw as Record<string, unknown>;
		const id = typeof r.id === "string" ? r.id.trim() : "";
		const name = typeof r.name === "string" ? r.name.trim() : "";
		const url = typeof r.url === "string" ? r.url.trim() : "";
		const type = typeof r.type === "string" ? r.type : "";
		const adapter = typeof r.adapter === "string" ? r.adapter : "";
		const config = (r.configuration ?? {}) as Record<string, unknown>;
		if (!ID_RE.test(id) || !name || !url || !type || !adapter) return null;

		// The crawler would silently collect nothing otherwise (same gate as
		// SourcesService.create) — refuse to store the source at all.
		if (!this.plugins.manifest(adapter)) return null;
		if (this.plugins.validateConfig(adapter, config)) return null;

		const category =
			typeof r.category === "string" && r.category ? r.category : "other";
		const fetchWindowDays =
			typeof r.fetchWindowDays === "number" && r.fetchWindowDays >= 0
				? Math.floor(r.fetchWindowDays)
				: 7;
		// Optional geography/language tags (v1.8.0) — validated as 2-letter ISO
		// codes; anything malformed is dropped (the source still materializes,
		// just untagged).
		const country =
			typeof r.country === "string" && /^[a-zA-Z]{2}$/.test(r.country.trim())
				? r.country.trim().toUpperCase()
				: null;
		const language =
			typeof r.language === "string" && /^[a-zA-Z]{2}$/.test(r.language.trim())
				? r.language.trim().toLowerCase()
				: null;
		const city =
			typeof r.city === "string" && r.city.trim() ? r.city.trim() : null;
		// Semantic metadata (v1.8.0) — parsed leniently so an older/malformed
		// list file still materializes; unknown enum values are dropped to null
		// rather than rejecting the whole list.
		const scope = SOURCE_SCOPES.includes(r.scope as never)
			? (r.scope as SourceListSourceDefinition["scope"])
			: null;
		const authority = SOURCE_AUTHORITIES.includes(r.authority as never)
			? (r.authority as SourceListSourceDefinition["authority"])
			: null;
		const impactAreas = Array.isArray(r.impactAreas)
			? (r.impactAreas as unknown[])
					.filter((v): v is string => typeof v === "string")
					.slice(0, 12)
			: null;
		return {
			id,
			name,
			url,
			type: type as SourceListSourceDefinition["type"],
			category: category as SourceListSourceDefinition["category"],
			adapter,
			configuration: config,
			fetchWindowDays,
			country,
			city,
			language,
			scope,
			authority,
			impactAreas,
		};
	}
}

interface ParsedListFile {
	id: string;
	name: string;
	description: string;
	nsfw: boolean;
	version: string | null;
	curator: string | null;
	sources: SourceListSourceDefinition[];
}

/**
 * Derive a community list's curator from its repo path (flexible layout):
 *   sources/security.json            → null (flat, general list)
 *   sources/jane/security.json       → "jane"
 *   sources/jane.doe/security.json   → "jane.doe"
 */
function curatorFor(path: string): string | null {
	const parts = path.split("/");
	if (parts.length <= 2) return null;
	const curator = parts[1]?.trim();
	if (!curator || curator.length > 64) return null;
	return curator;
}

/**
 * A list's real size (v1.8.1). The SQL join counts MATERIALIZED `sources`
 * rows, but community lists keep their definitions in `sources_json` and only
 * materialize rows when enabled — so a freshly-fetched (not-yet-enabled) list
 * used to report "0 sources" despite having definitions. The definition count
 * is the upper bound and the source of truth for "how many sites this list
 * offers"; once materialized the row count matches it.
 */
function effectiveSourceCount(
	defs: unknown[] | null | undefined,
	rowCount: number,
): number {
	const defsCount = Array.isArray(defs) ? defs.length : 0;
	return Math.max(rowCount, defsCount);
}

function toListInfo(
	row: SourceListRow,
	sourceCount: number,
	enabledCount: number,
): SourceListInfo {
	return {
		id: row.id,
		name: row.name,
		description: row.description,
		origin: row.origin as SourceListOrigin,
		nsfw: row.nsfw,
		enabled: row.enabled,
		version: row.version,
		curator: row.curator,
		sourceCount,
		enabledCount,
		// v1.8.1 — a community list with a known repo file can be updated.
		canUpdate: row.origin === "community" && Boolean(row.repoPath),
		updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
		createdAt: row.createdAt.toISOString(),
	};
}

/** Real network fetcher — media-service pattern (timeout, UA, failures → null). */
async function defaultFetch(url: string): Promise<string | null> {
	try {
		const res = await fetch(url, {
			headers: {
				"user-agent":
					"Mozilla/5.0 (compatible; Vorynth/1.8; +https://vorynth.local)",
			},
			redirect: "follow",
			signal: AbortSignal.timeout(15_000),
		});
		if (!res.ok) return null;
		return await res.text();
	} catch {
		return null;
	}
}
