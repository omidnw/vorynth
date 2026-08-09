import {
	BadRequestException,
	ConflictException,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { DatabaseService } from "../../db/database.service.js";
import { articles, sources } from "../../db/schema.js";
import { ftsRebuildIndex } from "../../db/fts-sync.js";
import { sweepOrphanSpines } from "../../db/spine.js";
import { PluginsService } from "../plugins/plugins.service.js";
import { CrawlerService } from "../crawler/crawler.service.js";
import { ConnectorRegistryService } from "../connector-registry/connector-registry.service.js";
import type {
	Article,
	BulkSourceEnableInput,
	CreateSourceInput,
	Source,
	SourceArticlesResult,
	SourceAuthority,
	SourceGroupDimension,
	SourceRange,
	SourceScope,
	SourceType,
	UpdateSourceInput,
	VerifySourceInput,
	VerifySourceResult,
} from "@vorynth/types";
import { SOURCE_AUTHORITIES, SOURCE_SCOPES } from "@vorynth/types";

@Injectable()
export class SourcesService {
	constructor(
		@Inject(DatabaseService) private readonly db: DatabaseService,
		@Inject(PluginsService) private readonly plugins: PluginsService,
		@Inject(CrawlerService) private readonly crawler: CrawlerService,
		@Inject(ConnectorRegistryService)
		private readonly connectors: ConnectorRegistryService,
	) {}

	async list(): Promise<Source[]> {
		const rows = await this.db.db.select().from(sources);
		return rows.map(toDto);
	}

	async get(id: string): Promise<Source> {
		const [row] = await this.db.db
			.select()
			.from(sources)
			.where(eq(sources.id, id))
			.limit(1);
		if (!row) throw new NotFoundException(`source ${id} not found`);
		return toDto(row);
	}

	async create(input: CreateSourceInput): Promise<Source> {
		// v1.8.0 — resolve the adapter from the type via the plugin registry and
		// validate the config against the adapter's schema BEFORE saving. The old
		// `defaultAdapterFor` pinned every type to RSS, so html/api/sitemap
		// sources saved fine but silently collected nothing.
		const adapter = await this.resolveAdapter(input.type);
		const config = (input.configuration ?? {}) as Record<string, unknown>;
		const configError = this.plugins.validateConfig(adapter, config);
		if (configError) {
			throw new BadRequestException({
				code: "INVALID_SOURCE_CONFIG",
				message: configError,
			});
		}

		const id = input.url
			? slugify(input.name) + "-" + randomUUID().slice(0, 8)
			: randomUUID();
		const row = {
			id,
			name: input.name,
			url: input.url,
			type: input.type,
			category: input.category,
			adapter,
			configuration: config,
			enabled: input.enabled ?? true,
			fetchWindowDays: input.fetchWindowDays ?? 7,
			country: normalizeTag(input.country, "country"),
			city: input.city ?? null,
			language: normalizeTag(input.language, "language"),
			scope: normalizeScope(input.scope),
			authority: normalizeAuthority(input.authority),
			impactAreas: normalizeImpactAreas(input.impactAreas),
			tags: normalizeTags(input.tags),
		};
		await this.db.db.insert(sources).values(row);
		const [created] = await this.db.db
			.select()
			.from(sources)
			.where(eq(sources.id, id))
			.limit(1);
		return toDto(created!);
	}

	async update(id: string, input: UpdateSourceInput): Promise<Source> {
		const patch: Record<string, unknown> = {};
		if (input.name !== undefined) patch.name = input.name;
		if (input.enabled !== undefined) patch.enabled = input.enabled;
		if (input.category !== undefined) patch.category = input.category;
		if (input.fetchWindowDays !== undefined) {
			patch.fetchWindowDays = Math.max(0, Math.floor(input.fetchWindowDays));
		}
		// Absolute range mode (v1.6.0): setting fetchFrom switches the source to
		// from/to dates; passing fetchFrom: null clears it back to relative.
		// Values arrive as ISO strings over JSON — coerce to Date for Drizzle.
		if (input.fetchFrom !== undefined) {
			patch.fetchFrom =
				input.fetchFrom === null ? null : new Date(input.fetchFrom);
		}
		if (input.fetchTo !== undefined) {
			patch.fetchTo = input.fetchTo === null ? null : new Date(input.fetchTo);
		}
		if (input.configuration !== undefined) {
			patch.configuration = input.configuration;
		}
		// Geography/language tags (v1.8.0) — country/language are 2-letter codes,
		// city is free text; null clears a tag.
		if (input.country !== undefined) {
			patch.country = normalizeTag(input.country, "country");
		}
		if (input.city !== undefined) patch.city = input.city ?? null;
		if (input.language !== undefined) {
			patch.language = normalizeTag(input.language, "language");
		}
		// Semantic metadata (v1.8.0) — scope/authority enums + impact-area
		// slugs; null clears a field.
		if (input.scope !== undefined) patch.scope = normalizeScope(input.scope);
		if (input.authority !== undefined) {
			patch.authority = normalizeAuthority(input.authority);
		}
		if (input.impactAreas !== undefined) {
			patch.impactAreas = normalizeImpactAreas(input.impactAreas);
		}
		// Free-form tags (v1.9.0) — lowercase slugs; null clears them.
		if (input.tags !== undefined) patch.tags = normalizeTags(input.tags);
		if (Object.keys(patch).length > 0) {
			await this.db.db.update(sources).set(patch).where(eq(sources.id, id));
		}
		return this.get(id);
	}

	/**
	 * Bulk enable/disable (v1.8.0) — the Sources page group master switches.
	 * Flips `enabled` on every source whose dimension equals `value`
	 * (e.g. all sources in category "security" or country "US"). Dimensions
	 * and values are whitelisted/validated; untagged sources are untouched.
	 */
	async bulkEnable(input: BulkSourceEnableInput): Promise<{ updated: number }> {
		const { dimension, value, enabled } = input;
		const column = dimensionColumn(dimension);
		if (!column) {
			throw new BadRequestException({
				code: "INVALID_GROUP_DIMENSION",
				message: `unknown group dimension "${dimension}"`,
			});
		}
		const v = (value ?? "").trim();
		if (!v) {
			throw new BadRequestException({
				code: "INVALID_GROUP_VALUE",
				message: "group value must not be empty",
			});
		}
		// Country/language codes are stored normalized (upper/lowercase); match
		// either case from the UI.
		const normalized =
			dimension === "country"
				? v.toUpperCase()
				: dimension === "language"
					? v.toLowerCase()
					: v;
		const { changes } = this.db.rawDb
			.prepare(`UPDATE sources SET enabled = ? WHERE ${column} = ?`)
			.run(enabled ? 1 : 0, normalized);
		return { updated: changes };
	}

	/**
	 * Remove a source. Articles cascade (FK), then orphaned archive spines and
	 * their bookmark flags are cleaned up — all in one transaction, so no
	 * orphans remain (R-A10).
	 *
	 * Domain ownership: when the source owns bookmarked articles, deletion is
	 * REFUSED by default (`409 BOOKMARKED_ARTICLES_EXIST`) — a bookmark is user
	 * ownership of a reference. `force=true` (the UI's explicit "Delete anyway"
	 * confirmation) proceeds and removes those bookmarks too.
	 */
	async remove(id: string, force = false): Promise<void> {
		const raw = this.db.rawDb;
		const { c: bookmarkedCount } = raw
			.prepare(
				`SELECT COUNT(*) AS c FROM articles a
				 JOIN bookmarks b ON b.content_item_id = a.content_item_id
				 WHERE a.source_id = ?`,
			)
			.get(id) as { c: number };

		if (bookmarkedCount > 0 && !force) {
			throw new ConflictException({
				code: "BOOKMARKED_ARTICLES_EXIST",
				bookmarkedCount,
				message: `${bookmarkedCount} saved storie(s) belong to this source. Delete anyway?`,
			});
		}

		raw.transaction(() => {
			// Articles cascade via the FK (ON DELETE CASCADE); spines and
			// bookmarks are cleaned up in the same atomic step. NOTE: the
			// transaction function must be invoked (`})()`) or nothing runs.
			raw.prepare("DELETE FROM sources WHERE id = ?").run(id);
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
	 * List this source's articles within a time window (v1.6.0).
	 *
	 * Informational over surviving data: retention pruning removes articles
	 * older than the source's fetch window, so a Year/custom range that
	 * predates retention comes back empty — `prunedNote` explains why.
	 */
	async articlesInRange(
		id: string,
		opts: { range?: SourceRange; from?: string; to?: string },
	): Promise<SourceArticlesResult> {
		const src = await this.get(id);

		const { fromMs, toMs, prunedNote } = rangeWindow(src.fetchWindowDays, opts);

		const rows = await this.db.db
			.select()
			.from(articles)
			.where(
				and(
					eq(articles.sourceId, id),
					fromMs !== null
						? gte(articles.publishedAt, new Date(fromMs))
						: undefined,
					toMs !== null ? lte(articles.publishedAt, new Date(toMs)) : undefined,
				),
			)
			.orderBy(desc(articles.publishedAt), desc(articles.collectedAt))
			.all();

		return {
			articles: rows.map(toArticleDto),
			total: rows.length,
			prunedNote,
		};
	}

	async setEnabled(id: string, enabled: boolean): Promise<Source> {
		return this.update(id, { enabled });
	}

	/**
	 * Resolve a source type to its adapter, AUTO-PROVISIONING the official
	 * connector from the GitHub registry when it isn't registered yet (v1.8.0 —
	 * the "source needs a connector → fetch it from GitHub → use it" flow).
	 *
	 * - adapter registered locally → its id;
	 * - not registered but the registry has it → provisioned, then its id;
	 * - not registered and no official connector exists → BadRequest
	 *   CONNECTOR_NOT_AVAILABLE (message mentions the version gate);
	 * - registry unreachable → ServiceUnavailableException REGISTRY_UNREACHABLE.
	 */
	private async resolveAdapter(type: SourceType): Promise<string> {
		try {
			return this.plugins.adapterFor(type);
		} catch {
			const connector = await this.connectors.ensureForType(type);
			if (connector) return this.plugins.adapterFor(type);
			throw new BadRequestException({
				code: "CONNECTOR_NOT_AVAILABLE",
				message: `No official connector for source type '${type}' is available in this Vorynth version. Check the connector registry (Plugins → Check GitHub for connectors) or update Vorynth.`,
			});
		}
	}

	/**
	 * Dry-run a source configuration (v1.8.0) — validates and fetches via the
	 * adapter WITHOUT persisting. Powers the Add Source form's "Test" button.
	 */
	async verify(input: VerifySourceInput): Promise<VerifySourceResult> {
		let adapter: string;
		try {
			adapter = await this.resolveAdapter(input.type);
		} catch (err) {
			return {
				ok: false,
				error: (err as Error).message,
				itemCount: 0,
				samples: [],
			};
		}
		return this.crawler.verifySource(
			adapter,
			(input.configuration ?? {}) as Record<string, unknown>,
		);
	}
}

function toDto(row: {
	id: string;
	name: string;
	url: string;
	type: string;
	category: string;
	adapter: string;
	configuration: unknown;
	enabled: boolean;
	fetchWindowDays: number | null;
	fetchFrom: Date | null;
	fetchTo: Date | null;
	lastCheckedAt: Date | null;
	createdAt: Date;
	listId: string | null;
	country: string | null;
	city: string | null;
	language: string | null;
	scope: string | null;
	authority: string | null;
	impactAreas: unknown;
	tags: unknown;
}): Source {
	return {
		id: row.id,
		name: row.name,
		url: row.url,
		type: row.type as Source["type"],
		category: row.category as Source["category"],
		adapter: row.adapter,
		configuration: (row.configuration ?? {}) as Source["configuration"],
		enabled: row.enabled,
		fetchWindowDays: row.fetchWindowDays ?? 7,
		fetchFrom: row.fetchFrom,
		fetchTo: row.fetchTo,
		lastCheckedAt: row.lastCheckedAt,
		createdAt: row.createdAt,
		listId: row.listId ?? null,
		country: row.country ?? null,
		city: row.city ?? null,
		language: row.language ?? null,
		scope: (row.scope ?? null) as Source["scope"],
		authority: (row.authority ?? null) as Source["authority"],
		impactAreas: Array.isArray(row.impactAreas)
			? (row.impactAreas as string[])
			: null,
		tags: Array.isArray(row.tags) ? (row.tags as string[]) : null,
	};
}

/** ISO country/language code validation: 2 letters, uppercased country. */
function normalizeTag(
	value: string | null | undefined,
	kind: "country" | "language",
): string | null {
	if (value === null || value === undefined || value === "") return null;
	const v = value.trim();
	if (!/^[a-zA-Z]{2}$/.test(v)) {
		throw new BadRequestException({
			code: "INVALID_TAG_CODE",
			message: `${kind} must be a 2-letter ISO code, got "${v}"`,
		});
	}
	return kind === "country" ? v.toUpperCase() : v.toLowerCase();
}

/** Source scope validation (v1.8.0) — must be a known enum value, else null. */
function normalizeScope(value: string | null | undefined): SourceScope | null {
	if (value === null || value === undefined || value === "") return null;
	if (!SOURCE_SCOPES.includes(value as SourceScope)) {
		throw new BadRequestException({
			code: "INVALID_SOURCE_SCOPE",
			message: `unknown source scope "${value}"`,
		});
	}
	return value as SourceScope;
}

/** Source authority validation (v1.8.0) — must be a known enum value. */
function normalizeAuthority(
	value: string | null | undefined,
): SourceAuthority | null {
	if (value === null || value === undefined || value === "") return null;
	if (!SOURCE_AUTHORITIES.includes(value as SourceAuthority)) {
		throw new BadRequestException({
			code: "INVALID_SOURCE_AUTHORITY",
			message: `unknown source authority "${value}"`,
		});
	}
	return value as SourceAuthority;
}

/**
 * Impact-area normalization (v1.8.0) — an array of lowercase hyphenated slugs
 * ("ai", "programming-languages"). Deduped and capped at 12; null/empty clears.
 * Free-form values are accepted (like categories) — the curated vocabulary is
 * a UI suggestion, not a constraint.
 */
function normalizeImpactAreas(
	value: string[] | null | undefined,
): string[] | null {
	if (value === null || value === undefined) return null;
	if (!Array.isArray(value)) {
		throw new BadRequestException({
			code: "INVALID_SOURCE_IMPACT_AREAS",
			message: "impactAreas must be an array of slugs",
		});
	}
	const cleaned = value
		.map((v) =>
			String(v)
				.trim()
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, "-")
				.replace(/^-+|-+$/g, ""),
		)
		.filter((v) => v.length >= 2 && v.length <= 64);
	const unique = [...new Set(cleaned)].slice(0, 12);
	return unique.length > 0 ? unique : null;
}

/**
 * Free-form tag normalization (v1.9.0) — lowercase hyphenated slugs like the
 * impact areas ("cloud", "ai"). Deduped and capped at 12; null/empty clears.
 * The curated vocabulary (tech-catalog + app vocab) is a UI suggestion, never
 * a constraint — same free-form policy as `normalizeImpactAreas`.
 */
function normalizeTags(value: string[] | null | undefined): string[] | null {
	if (value === null || value === undefined) return null;
	if (!Array.isArray(value)) {
		throw new BadRequestException({
			code: "INVALID_SOURCE_TAGS",
			message: "tags must be an array of slugs",
		});
	}
	const cleaned = value
		.map((v) =>
			String(v)
				.trim()
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, "-")
				.replace(/^-+|-+$/g, ""),
		)
		.filter((v) => v.length >= 2 && v.length <= 64);
	const unique = [...new Set(cleaned)].slice(0, 12);
	return unique.length > 0 ? unique : null;
}

/** Whitelisted group dimension → sources column. */
function dimensionColumn(
	dimension: SourceGroupDimension,
): "category" | "country" | "city" | "language" | null {
	switch (dimension) {
		case "category":
		case "country":
		case "city":
		case "language":
			return dimension;
		default:
			return null;
	}
}

function toArticleDto(row: {
	id: string;
	sourceId: string;
	title: string;
	originalTitle: string | null;
	content: string;
	translatedContent: string | null;
	url: string;
	author: string | null;
	publishedAt: Date | null;
	collectedAt: Date;
	hash: string;
	contentItemId: string | null;
}): Article {
	return {
		id: row.id,
		sourceId: row.sourceId,
		title: row.title,
		originalTitle: row.originalTitle,
		content: row.content,
		translatedContent: row.translatedContent,
		url: row.url,
		author: row.author,
		publishedAt: row.publishedAt,
		collectedAt: row.collectedAt,
		hash: row.hash,
		contentItemId: row.contentItemId,
	};
}

const RANGE_MS: Record<Exclude<SourceRange, "custom">, number> = {
	day: 86_400_000,
	week: 7 * 86_400_000,
	month: 30 * 86_400_000,
	year: 365 * 86_400_000,
};

/**
 * Resolve a range window into [fromMs, toMs] over `published_at`, plus the
 * retention explainer. `custom` parses ISO `from`/`to`. `prunedNote` is set
 * when the window starts before the source's retention cutoff (i.e. older
 * articles were pruned and can't be shown).
 */
function rangeWindow(
	fetchWindowDays: number,
	opts: { range?: SourceRange; from?: string; to?: string },
): { fromMs: number | null; toMs: number | null; prunedNote: string | null } {
	const now = Date.now();
	const range = opts.range ?? "week";

	let fromMs: number | null;
	let toMs: number | null = null;
	if (range === "custom") {
		fromMs = opts.from ? new Date(opts.from).getTime() : null;
		toMs = opts.to ? new Date(opts.to).getTime() : null;
		if (Number.isNaN(fromMs)) fromMs = null;
		if (Number.isNaN(toMs)) toMs = null;
	} else if (range in RANGE_MS) {
		fromMs = now - RANGE_MS[range as Exclude<SourceRange, "custom">];
	} else {
		fromMs = now - RANGE_MS.week;
	}

	let prunedNote: string | null = null;
	if (fetchWindowDays > 0) {
		const retentionCutoff = now - fetchWindowDays * 86_400_000;
		if (fromMs !== null && fromMs < retentionCutoff) {
			prunedNote = `Articles older than this source's ${fetchWindowDays}-day retention window were pruned — this range only shows what is still stored.`;
		}
	}
	return { fromMs, toMs, prunedNote };
}

function slugify(s: string): string {
	return s
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 40);
}
