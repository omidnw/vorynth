import {
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
import type {
	Article,
	CreateSourceInput,
	Source,
	SourceArticlesResult,
	SourceRange,
	UpdateSourceInput,
} from "@vorynth/types";

@Injectable()
export class SourcesService {
	constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

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
		const id = input.url
			? slugify(input.name) + "-" + randomUUID().slice(0, 8)
			: randomUUID();
		const row = {
			id,
			name: input.name,
			url: input.url,
			type: input.type,
			category: input.category,
			adapter: input.adapter ?? defaultAdapterFor(input.type),
			configuration: (input.configuration ?? {}) as Record<string, unknown>,
			enabled: input.enabled ?? true,
			fetchWindowDays: input.fetchWindowDays ?? 7,
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
		if (input.fetchWindowDays !== undefined) {
			patch.fetchWindowDays = Math.max(0, Math.floor(input.fetchWindowDays));
		}
		// Absolute range mode (v1.6.0): setting fetchFrom switches the source to
		// from/to dates; passing fetchFrom: null clears it back to relative.
		// Values arrive as ISO strings over JSON — coerce to Date for Drizzle.
		if (input.fetchFrom !== undefined) {
			patch.fetchFrom = input.fetchFrom === null ? null : new Date(input.fetchFrom);
		}
		if (input.fetchTo !== undefined) {
			patch.fetchTo = input.fetchTo === null ? null : new Date(input.fetchTo);
		}
		if (input.configuration !== undefined) {
			patch.configuration = input.configuration;
		}
		if (Object.keys(patch).length > 0) {
			await this.db.db.update(sources).set(patch).where(eq(sources.id, id));
		}
		return this.get(id);
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
			raw.prepare(
				`DELETE FROM content_items
				 WHERE id NOT IN (SELECT content_item_id FROM articles WHERE content_item_id IS NOT NULL)
				   AND id NOT IN (SELECT content_item_id FROM search_history WHERE content_item_id IS NOT NULL)
				   AND id NOT IN (SELECT content_item_id FROM brief_history WHERE content_item_id IS NOT NULL)
				   AND id NOT IN (SELECT content_item_id FROM generated_history WHERE content_item_id IS NOT NULL)`,
			).run();
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
	};
}

function toArticleDto(row: {
	id: string;
	sourceId: string;
	title: string;
	originalTitle: string | null;
	content: string;
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

function defaultAdapterFor(type: CreateSourceInput["type"]): string {
	if (type === "rss") return "rss";
	return "rss";
}

function slugify(s: string): string {
	return s
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 40);
}
