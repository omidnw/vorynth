import { Inject, Injectable, Logger } from "@nestjs/common";
import { desc, eq, gte, inArray } from "drizzle-orm";
import { DatabaseService } from "../../db/database.service.js";
import { articles, sources } from "../../db/schema.js";
import type {
	ArticleDetail,
	BriefEntry,
	BriefPeriod,
	ImportanceTier,
	SourceCategory,
} from "@vorynth/types";
import { tierFor } from "../intelligence/nodes/tier.js";

/** Resolve a period into a `since` cutoff timestamp (or null = no cutoff). */
export function periodSince(
	period: BriefPeriod,
	now = Date.now(),
): number | null {
	switch (period) {
		case "today":
			return startOfDay(now);
		case "week":
			return now - 7 * 86_400_000;
		case "month":
			return now - 30 * 86_400_000;
		case "all":
		default:
			return null;
	}
}

/** Re-exported for engine-internal callers that want the shared type. */
export type { BriefPeriod };

function startOfDay(now: number): number {
	const d = new Date(now);
	d.setHours(0, 0, 0, 0);
	return d.getTime();
}

/**
 * The news layer — always available, no LLM required.
 *
 * This is Vorynth's zero-configuration mode: open the app, read fresh
 * multi-source news ranked by a deterministic freshness/relevance heuristic.
 * When the user adds an API key, the IntelligenceService layers AI analysis on
 * top of the same entries.
 */
@Injectable()
export class NewsService {
	private readonly logger = new Logger("News");

	constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

	/**
	 * Build the ranked Brief from collected articles (no LLM involved).
	 * `period` filters by collected time; `limit` caps how many to return.
	 */
	async buildBrief(
		opts: { limit?: number; period?: BriefPeriod } = {},
	): Promise<{
		entries: BriefEntry[];
		totalStories: number;
		totalSources: number;
		period: BriefPeriod;
	}> {
		const limit = opts.limit ?? 30;
		const period: BriefPeriod = opts.period ?? "all";
		const since = periodSince(period);

		const where = since
			? gte(articles.collectedAt, new Date(since))
			: undefined;

		const articleRows = await (where
			? this.db.db
					.select()
					.from(articles)
					.where(where)
					.orderBy(desc(articles.publishedAt), desc(articles.collectedAt))
					.limit(limit)
			: this.db.db
					.select()
					.from(articles)
					.orderBy(desc(articles.publishedAt), desc(articles.collectedAt))
					.limit(limit));

		const enabledSources = await this.db.db
			.select()
			.from(sources)
			.where(eq(sources.enabled, true));

		if (articleRows.length === 0) {
			return {
				entries: [],
				totalStories: 0,
				totalSources: enabledSources.length,
				period,
			};
		}

		// Real count of matching stories for the period (not just the capped page).
		const countRow = where
			? await this.db.db.select({ n: articles.id }).from(articles).where(where)
			: await this.db.db.select({ n: articles.id }).from(articles);
		const totalStories = countRow.length;

		const sourceIds = [...new Set(articleRows.map((a) => a.sourceId))];
		const sourceRows = await this.db.db
			.select()
			.from(sources)
			.where(inArray(sources.id, sourceIds));
		const sourceById = new Map(sourceRows.map((s) => [s.id, s]));

		const now = Date.now();
		const scored = articleRows.map((a) => {
			const src = sourceById.get(a.sourceId);
			const category = (src?.category ?? "other") as SourceCategory;
			const score = rankScore({
				category,
				publishedAt: a.publishedAt ? a.publishedAt.getTime() : null,
				contentLength: a.content?.length ?? 0,
				now,
			});
			return {
				article: a,
				category,
				sourceName: src?.name ?? "Unknown",
				score,
			};
		});

		scored.sort((a, b) => b.score - a.score);

		const entries: BriefEntry[] = scored.map((s, idx) => ({
			rank: idx + 1,
			article: toArticleDto(s.article),
			category: s.category,
			sourceNames: [s.sourceName],
			score: s.score,
			importanceTier: tierFor(s.score) as ImportanceTier,
			insight: null,
		}));

		return {
			entries,
			totalStories,
			totalSources: enabledSources.length,
			period,
		};
	}

	/**
	 * Fetch one article by id, joined with its source name + category.
	 * Powers the native Article reader page (`GET /articles/:id`). Returns
	 * `null` when the article doesn't exist (deleted, bad id) so the route can
	 * render a not-found state.
	 */
	async getArticleDetail(id: string): Promise<ArticleDetail | null> {
		const row = await this.db.db
			.select({ article: articles, source: sources })
			.from(articles)
			.innerJoin(sources, eq(sources.id, articles.sourceId))
			.where(eq(articles.id, id))
			.get();
		if (!row) return null;
		return {
			article: toArticleDto(row.article),
			sourceName: row.source.name,
			sourceCategory: row.source.category as SourceCategory,
		};
	}

	/**
	 * Attach freshly-generated insights to existing entries by articleId.
	 * Accepts raw insight rows (from Drizzle or the workflow) and normalizes
	 * them into the `Insight` DTO.
	 */
	attachInsights(
		entries: BriefEntry[],
		insightsByArticle: Map<string, RawInsight>,
	): BriefEntry[] {
		return entries.map((e) => {
			const raw = insightsByArticle.get(e.article.id);
			if (!raw) return e;
			const insight: BriefEntry["insight"] = {
				id: raw.id,
				clusterId: raw.clusterId,
				articleId: raw.articleId,
				summary: raw.summary,
				significance: raw.significance,
				impact: raw.impact,
				importanceScore: raw.importanceScore,
				importanceTier: raw.importanceTier as NonNullable<
					BriefEntry["insight"]
				>["importanceTier"],
				category: raw.category as NonNullable<
					BriefEntry["insight"]
				>["category"],
				recommendedAction: raw.recommendedAction,
				generatedLanguage: raw.generatedLanguage,
				createdAt: raw.createdAt,
			};
			return {
				...e,
				insight,
				// LLM importance overrides the deterministic one when available.
				importanceTier: insight.importanceTier,
			};
		});
	}
}

/** Structural shape accepted by attachInsights (raw DB row or workflow output). */
interface RawInsight {
	id: string;
	clusterId: string | null;
	articleId: string | null;
	summary: string;
	significance: string;
	impact: string;
	importanceScore: number;
	importanceTier: string;
	category: string;
	recommendedAction: string;
	generatedLanguage: string;
	createdAt: Date;
}

// ── helpers ────────────────────────────────────────────────────────────────

const SOURCE_RELIABILITY: Record<SourceCategory, number> = {
	ai: 7,
	security: 8,
	"software-engineering": 6,
	cloud: 5,
	devops: 5,
	backend: 4,
	"web-development": 4,
	"programming-languages": 5,
	"open-source": 5,
	other: 3,
};

function rankScore(opts: {
	category: SourceCategory;
	publishedAt: number | null;
	contentLength: number;
	now: number;
}): number {
	const reliability = SOURCE_RELIABILITY[opts.category] ?? 3;
	const freshness = freshnessScore(opts.publishedAt, opts.now);
	const lengthSignal = Math.min(2, opts.contentLength / 2000);
	return Number(
		Math.min(10, reliability * 0.6 + freshness * 2 + lengthSignal).toFixed(2),
	);
}

function freshnessScore(publishedAtMs: number | null, now: number): number {
	if (!publishedAtMs) return 0.5;
	const ageHours = (now - publishedAtMs) / 3_600_000;
	if (ageHours < 6) return 2;
	if (ageHours < 24) return 1.5;
	if (ageHours < 72) return 1;
	if (ageHours < 168) return 0.5;
	return 0.1;
}

function toArticleDto(row: {
	id: string;
	sourceId: string;
	title: string;
	content: string;
	url: string;
	author: string | null;
	publishedAt: Date | null;
	collectedAt: Date;
	hash: string;
}): BriefEntry["article"] {
	return {
		id: row.id,
		sourceId: row.sourceId,
		title: row.title,
		content: row.content,
		url: row.url,
		author: row.author,
		publishedAt: row.publishedAt,
		collectedAt: row.collectedAt,
		hash: row.hash,
	};
}
