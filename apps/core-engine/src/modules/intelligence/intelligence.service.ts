import { Inject, Injectable, Logger } from "@nestjs/common";
import { eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { DatabaseService } from "../../db/database.service.js";
import { aiInsights, articleClusters, articles, userProfile } from "../../db/schema.js";
import type {
	BriefEntry,
	BriefPeriod,
	Insight,
	PeriodSummary,
	TodaysBrief,
} from "@vorynth/types";
import { LlmService } from "../llm/llm.service.js";
import { NewsService } from "../news/news.service.js";
import { HistoryService } from "../history/history.service.js";
import { buildIntelligenceGraph } from "./workflows/intelligence.workflow.js";
import {
	buildSummaryPrompt,
	parseSummaryDraft,
} from "./prompts/summary.prompt.js";
import {
	buildTranslationPrompt,
	parseTranslationBatch,
	type ParsedTranslation,
} from "./prompts/translation.prompt.js";
import { extractCitedNumbers, resolveCitations } from "./prompts/citations.js";
import { ftsUpdateArticle } from "../../db/fts-sync.js";

/**
 * Orchestrates intelligence runs.
 *
 *   generate()        run the LangGraph workflow ONLY when an LLM provider is
 *                     configured, then layer the resulting insights on top of
 *                     the ranked news feed. With no key, returns the bare feed.
 *
 *   today()           read the most recent brief: news feed enriched with any
 *                     stored insights (today scope).
 *
 *   getRange(period)  ranked feed filtered to a time range (today/week/month/all).
 *
 *   summarizePeriod(period)  ask the LLM to write one cohesive intelligence
 *                            brief over the whole period's worth of stories
 *                            (only meaningful when an LLM is configured).
 */
@Injectable()
export class IntelligenceService {
	private readonly logger = new Logger("Intelligence");

	constructor(
		@Inject(DatabaseService) private readonly db: DatabaseService,
		@Inject(LlmService) private readonly llm: LlmService,
		@Inject(NewsService) private readonly news: NewsService,
		@Inject(HistoryService) private readonly history: HistoryService,
	) {}

	async generate(
		opts: {
			targetLanguage?: string;
			cap?: number;
			period?: BriefPeriod;
		} = {},
	): Promise<TodaysBrief> {
		const targetLanguage =
			opts.targetLanguage ?? (await this.readIntelligenceLanguage());
		const cap = opts.cap ?? 10;
		const period: BriefPeriod = opts.period ?? "all";
		const intelligenceEnabled = await this.llm.isAvailable();

		// Always start from the ranked news feed scoped to the period.
		const { entries, totalStories, totalSources } = await this.news.buildBrief({
			limit: cap * 3,
			period,
		});

		if (!intelligenceEnabled) {
			this.logger.log("no LLM provider available — returning news-only brief");
			return {
				report: null,
				entries,
				totalStories,
				totalSources,
				intelligenceEnabled: false,
				generatedAt: null,
			};
		}

		// Run the LangGraph pipeline over the freshest articles in the period.
		const candidateArticles = entries.slice(0, cap).map((e) => e.article);
		const categoryByArticle = new Map(
			candidateArticles.map((a) => [
				a.id,
				entries.find((e) => e.article.id === a.id)?.category ?? "other",
			]),
		);

		const graph = buildIntelligenceGraph({
			loadArticles: async () => candidateArticles,
			categoryByArticle,
			llm: this.llm,
			analyzeCap: cap,
		});

		const result = await graph.invoke({
			runId: randomUUID(),
			targetLanguage,
			topics: [],
			articles: [],
			pipeline: [],
			insights: [],
			totalSeen: candidateArticles.length,
		});

		const insights = result.insights ?? [];
		const persisted = await this.persist(insights, targetLanguage);
		this.logger.log(`generated ${persisted.length} insights over ${period}`);

		// Layer insights onto the feed by articleId.
		const insightByArticle = new Map(
			persisted.map((i) => [i.articleId ?? "", i]),
		);
		const enriched = this.news.attachInsights(entries, insightByArticle);

		return {
			report: {
				id: randomUUID(),
				kind:
					period === "week"
						? "weekly"
						: period === "month"
							? "monthly"
							: "daily",
				periodStart: new Date().toISOString().slice(0, 10),
				periodEnd: new Date().toISOString().slice(0, 10),
				insightIds: persisted.map((i) => i.id),
				language: targetLanguage,
				createdAt: new Date(),
			},
			entries: enriched,
			totalStories,
			totalSources,
			intelligenceEnabled: true,
			generatedAt: new Date(),
		};
	}

	/** Read today's news feed, enriched with stored insights. */
	async today(): Promise<TodaysBrief> {
		return this.getRange("today");
	}

	/** Ranked feed for a time range, enriched with any stored insights. */
	async getRange(period: BriefPeriod): Promise<TodaysBrief> {
		const intelligenceEnabled = await this.llm.isAvailable();
		const { entries, totalStories, totalSources } = await this.news.buildBrief({
			limit: 30,
			period,
		});

		if (entries.length === 0 || !intelligenceEnabled) {
			return {
				report: null,
				entries,
				totalStories,
				totalSources,
				intelligenceEnabled,
				generatedAt: null,
			};
		}

		// Attach any insights we've previously generated for these articles.
		const articleIds = entries.map((e) => e.article.id);
		const rows = await this.db.db
			.select()
			.from(aiInsights)
			.where(inArray(aiInsights.articleId, articleIds));
		const insightByArticle = new Map(
			rows.map((r) => [r.articleId ?? "", toInsightDto(r)]),
		);
		const enriched = this.news.attachInsights(entries, insightByArticle);

		const latest = rows[0];
		return {
			report: latest
				? {
						id: "latest",
						kind: "daily",
						periodStart: new Date(latest.createdAt).toISOString().slice(0, 10),
						periodEnd: new Date(latest.createdAt).toISOString().slice(0, 10),
						insightIds: rows.map((r) => r.id),
						language: latest.generatedLanguage,
						createdAt: latest.createdAt,
					}
				: null,
			entries: enriched,
			totalStories,
			totalSources,
			intelligenceEnabled,
			generatedAt: latest?.createdAt ?? null,
		};
	}

	/**
	 * Generate ONE cohesive intelligence summary over all stories in a period.
	 *
	 * Unlike `generate()` (which analyzes each article individually), this
	 * bundles the period's headlines into a single LLM call and produces a
	 * short briefing — "what happened this week, what it means, what to do."
	 * Returns null in news mode (no LLM).
	 */
	async summarizePeriod(
		opts: {
			period?: BriefPeriod;
			targetLanguage?: string;
			limit?: number;
		} = {},
	): Promise<PeriodSummary | null> {
		const period: BriefPeriod = opts.period ?? "week";
		const targetLanguage =
			opts.targetLanguage ?? (await this.readIntelligenceLanguage());
		const intelligenceEnabled = await this.llm.isAvailable();
		if (!intelligenceEnabled) return null;

		const { entries } = await this.news.buildBrief({
			limit: opts.limit ?? 25,
			period,
		});
		if (entries.length === 0) {
			return {
				period,
				headline: "No stories in this period.",
				themes: [],
				takeaways: [],
				recommendedActions: [],
				citations: [],
				storyCount: 0,
			};
		}

		// Build the numbered context the prompt will reference with [N].
		// The order here MUST match what buildSummaryPrompt emits as [1], [2], …
		const context = entries.map((e) => ({
			articleId: e.article.id,
			title: e.article.title,
			sourceName: e.sourceNames[0] ?? "unknown",
			url: e.article.url,
			publishedAt: e.article.publishedAt
				? new Date(e.article.publishedAt).toISOString().slice(0, 10)
				: null,
		}));

		const { system, user } = buildSummaryPrompt({
			period,
			targetLanguage,
			stories: context.map((c) => ({
				title: c.title,
				category:
					entries.find((e) => e.article.id === c.articleId)?.category ??
					"other",
				source: c.sourceName,
				when: c.publishedAt ?? "unknown",
			})),
		});

		// Route through the dedicated summarize path (NOT analyze): the prompt
		// shape is summary-specific (arrays + theme rationale), and analyze()
		// would discard our system message and re-wrap with the per-article
		// prompt. summarize() sends system + user directly to the provider.
		const raw = await this.llm.summarize({
			system,
			user,
			outputLanguage: targetLanguage,
		});
		const draft = parseSummaryDraft(raw);

		// Resolve [N] markers across every generated string → real Citations.
		const citedNumbers = extractCitedNumbers(
			draft.headline,
			...draft.takeaways,
			...draft.recommendedActions,
			...draft.themes.map((t) => t.rationale),
		);
		const citations = resolveCitations(citedNumbers, context);

		// Themes: prefer the LLM's semantic themes (with rationale). Fall back
		// to top categories by count when the model omitted them, so the panel
		// never renders an empty themes row.
		let themes: PeriodSummary["themes"] = draft.themes.map((t) => ({
			name: t.name,
			rationale: t.rationale,
		}));
		if (themes.length === 0) {
			const categoryCount = new Map<string, number>();
			for (const e of entries) {
				categoryCount.set(e.category, (categoryCount.get(e.category) ?? 0) + 1);
			}
			themes = [...categoryCount.entries()]
				.sort((a, b) => b[1] - a[1])
				.slice(0, 4)
				.map(([name, count]) => ({ name, count }));
		}

		const summary: PeriodSummary = {
			period,
			headline:
				draft.headline ||
				`${entries.length} stories across ${themes.length} themes this ${period}.`,
			themes,
			takeaways: draft.takeaways,
			recommendedActions: draft.recommendedActions,
			citations,
			storyCount: entries.length,
		};

		// Persist so the user can revisit this briefing from the History drawer.
		const { start, end } = periodBounds(period);
		this.history.recordBrief({
			period,
			periodStart: start,
			periodEnd: end,
			result: summary,
		});

		return summary;
	}

	/** Single insight + its article, for the detail view. */
	async getInsight(insightId: string): Promise<Insight | null> {
		const [row] = await this.db.db
			.select()
			.from(aiInsights)
			.where(eq(aiInsights.id, insightId))
			.limit(1);
			return row ? toInsightDto(row) : null;
	}

	/**
	 * Count insights that have a valid article reference (used by the job
	 * system to set itemsTotal for progress reporting).
	 */
	countInsights(): number {
		const row = this.db.rawDb
			.prepare(
				`SELECT COUNT(*) AS n FROM ai_insights WHERE article_id IS NOT NULL`,
			)
			.get() as { n: number } | undefined;
		return row?.n ?? 0;
	}

	/**
	 * Regenerate ALL existing insights (significance, impact, recommendedAction)
	 * using the user's current intelligence language. Skips insights whose
	 * corresponding article no longer exists.
	 *
	 * @param onProgress  Optional callback invoked after each insight update
	 *                    with (done, total) for job progress reporting.
	 * @param targetLanguage  Override language; when omitted reads from profile.
	 * @param resumeFrom  How many insights were already done before a restart
	 *                    resumed this job — the loop starts past them (the row
	 *                    list is stable, so an index offset is safe).
	 * @param throwIfCanceled  Optional; throws "job canceled" between items so a
	 *                         canceled job actually stops.
	 * @returns  Number of insights regenerated.
	 */
	async regenerateAllInsights(
		onProgress?: (done: number, total: number) => void,
		targetLanguage?: string,
		resumeFrom = 0,
		throwIfCanceled?: () => void,
	): Promise<number> {
		const lang =
			targetLanguage ?? (await this.readIntelligenceLanguage());

		// Fetch all insights that have an associated article, joined so we
		// can filter to those whose article still exists.
		const rows = this.db.rawDb
			.prepare(
				`SELECT i.id AS insightId, i.article_id AS articleId,
				        a.title AS articleTitle, a.content AS articleContent,
				        i.generated_language AS currentLanguage
				 FROM ai_insights i
				 INNER JOIN articles a ON a.id = i.article_id
				 WHERE i.article_id IS NOT NULL`,
			)
			.all() as Array<{
			insightId: string;
			articleId: string;
			articleTitle: string;
			articleContent: string;
			currentLanguage: string;
		}>;

		const total = rows.length;
		// Skip insights whose LLM call already completed before a restart
		// resumed this job — progress continues from the checkpoint.
		const start = Math.min(Math.max(resumeFrom, 0), total);
		let done = 0;
		let regenerated = 0;

		const updateStmt = this.db.rawDb.prepare(
			`UPDATE ai_insights
			 SET significance = ?, impact = ?, recommended_action = ?,
			     generated_language = ?
			 WHERE id = ?`,
		);

		for (const row of rows) {
			if (done < start) {
				done++;
				continue;
			}
			throwIfCanceled?.();
			try {
				const draft = await this.llm.analyze({
					articleTitle: row.articleTitle,
					articleContent: row.articleContent,
					outputLanguage: lang,
				});

				updateStmt.run(
					draft.significance,
					draft.impact,
					draft.recommendedAction,
					lang,
					row.insightId,
				);
				regenerated++;
			} catch (err) {
				this.logger.warn(
					`regenerate failed for insight ${row.insightId} (article "${row.articleTitle}"): ${(err as Error).message}`,
				);
				// Per-item failure — skip, keep going.
			}

			done++;
			onProgress?.(done, total);
		}

		this.logger.log(
			`regenerateAllInsights: ${regenerated}/${total} insights updated to "${lang}"`,
		);
		return regenerated;
	}

	/**
	 * Translate all stories' titles AND bodies into the user's intelligence
	 * language, batching several stories per LLM request (JSON output) so a
	 * large collection needs far fewer calls.
	 *
	 * The body translation is stored in `translated_content`; `content` stays
	 * the canonical original so search and AI analysis keep operating on source
	 * text (R-A05). Titles follow the existing pattern: `title` becomes the
	 * translation and `original_title` keeps the FIRST original forever.
	 *
	 * Idempotent via its WHERE clause (rows with a translated body are
	 * excluded), so a restart needs no resume offset — the query itself is the
	 * checkpoint, matching the previous title-only job.
	 *
	 * @param onProgress  Invoked after each batch with (done, total).
	 * @param targetLanguage  Override language; when omitted reads from profile.
	 * @param _resumeFrom  Ignored on purpose: the WHERE clause already excludes
	 *                     translated stories, so a restarted job naturally picks
	 *                     up where it left off.
	 * @param throwIfCanceled  Optional; throws "job canceled" between batches so a
	 *                         canceled job actually stops.
	 * @returns  Number of stories successfully translated.
	 */
	async translateAllStories(
		onProgress?: (done: number, total: number) => void,
		targetLanguage?: string,
		_resumeFrom = 0,
		throwIfCanceled?: () => void,
	): Promise<number> {
		const lang = targetLanguage ?? (await this.readIntelligenceLanguage());

		const rows = this.db.rawDb
			.prepare(
				`SELECT id, title, content, author
				 FROM articles
				 WHERE content != ''
				   AND (translated_content IS NULL OR translated_content = '')
				 ORDER BY collected_at DESC`,
			)
			.all() as Array<{
			id: string;
			title: string;
			content: string;
			author: string | null;
		}>;

		const total = rows.length;
		let done = 0;
		let translated = 0;

		const updateStmt = this.db.rawDb.prepare(
			`UPDATE articles SET
			   title = ?,
			   original_title = CASE
			     WHEN original_title IS NULL OR original_title = '' THEN ?
			     ELSE original_title
			   END,
			   translated_content = ?
			 WHERE id = ?`,
		);

		for (const batch of chunkForTranslation(rows)) {
			throwIfCanceled?.();

			let parsed: ParsedTranslation[] = [];
			try {
				const { system, user } = buildTranslationPrompt({
					targetLanguage: lang,
					items: batch,
				});
				const raw = await this.llm.generate({
					system,
					user,
					outputLanguage: lang,
				});
				parsed = parseTranslationBatch(raw);
			} catch (err) {
				this.logger.warn(
					`translation batch failed for ${batch.length} stories (${(err as Error).message}) — skipping`,
				);
			}

			// Match by id so a mis-ordered or partially-valid response still
			// applies safely; missing entries stay pending for the next run.
			const byId = new Map(parsed.map((p) => [p.id, p]));
			for (const row of batch) {
				const hit = byId.get(row.id);
				if (!hit) continue;
				updateStmt.run(hit.title, row.title, hit.content, row.id);
				// Keep the FTS index in sync with the rewritten title (content
				// is unchanged by this job).
				ftsUpdateArticle(
					this.db.rawDb,
					row.id,
					hit.title,
					row.content,
					row.author,
				);
				translated++;
			}

			done += batch.length;
			onProgress?.(done, total);
		}

		this.logger.log(
			`translateAllStories: ${translated}/${total} stories translated to "${lang}"`,
		);
		return translated;
	}

	/**
	 * Read the user's preferred intelligence language from the profile row.
	 * Falls back to "en" when the profile hasn't been customized.
	 */
	private async readIntelligenceLanguage(): Promise<string> {
		const row = await this.db.db
			.select({ lang: userProfile.preferredIntelligenceLanguage })
			.from(userProfile)
			.where(eq(userProfile.id, "default"))
			.get();
		return (row?.lang ?? "en").trim() || "en";
	}

	// ── persistence ──────────────────────────────────────────────────────────

	private async persist(
		insights: Array<{
			articleId: string;
			clusterId: string;
			summary: string;
			significance: string;
			impact: string;
			recommendedAction: string;
			importanceScore: number;
			importanceTier: string;
			category: string;
		}>,
		language: string,
	) {
		if (insights.length === 0) return [];

		const clusterRows = insights.map((i) => ({
			id: i.clusterId,
			title: i.summary.slice(0, 80),
			category: i.category,
			articleIds: [i.articleId],
		}));
		await this.db.db
			.insert(articleClusters)
			.values(clusterRows)
			.onConflictDoNothing();

		const insightRows = insights.map((i) => ({
			id: randomUUID(),
			clusterId: i.clusterId,
			articleId: i.articleId,
			summary: i.summary,
			significance: i.significance,
			impact: i.impact,
			recommendedAction: i.recommendedAction,
			importanceScore: i.importanceScore,
			importanceTier: i.importanceTier as "signal" | "trend" | "low-noise",
			category: i.category,
			generatedLanguage: language,
		}));
		await this.db.db.insert(aiInsights).values(insightRows);

		return this.db.db
			.select()
			.from(aiInsights)
			.where(
				inArray(
					aiInsights.id,
					insightRows.map((r) => r.id),
				),
			);
	}
}

function toInsightDto(row: {
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
}): Insight {
	return {
		id: row.id,
		clusterId: row.clusterId,
		articleId: row.articleId,
		summary: row.summary,
		significance: row.significance,
		impact: row.impact,
		importanceScore: row.importanceScore,
		importanceTier: row.importanceTier as Insight["importanceTier"],
		category: row.category as Insight["category"],
		recommendedAction: row.recommendedAction,
		generatedLanguage: row.generatedLanguage,
		createdAt: row.createdAt,
	};
}

/** Keep BriefEntry happy when re-imported for typing in attach step. */
export type { BriefEntry };

// ── Translate Stories batching ───────────────────────────────────────────────

/** Stories per LLM request (user preference — 5 is the sweet spot). */
const BATCH_MAX_ITEMS = 5;
/**
 * Combined-content guard: a batch never carries more than this many characters
 * so very long articles can't blow the model's context. A single oversized
 * story still gets its own batch (full fidelity beats truncation).
 */
const BATCH_CHAR_CAP = 12_000;

interface TranslationRow {
	id: string;
	title: string;
	content: string;
	author: string | null;
}

/** Greedy chunking: at most `BATCH_MAX_ITEMS` stories and `BATCH_CHAR_CAP` chars per batch. */
function chunkForTranslation(rows: TranslationRow[]): TranslationRow[][] {
	const batches: TranslationRow[][] = [];
	let current: TranslationRow[] = [];
	let chars = 0;
	for (const row of rows) {
		const rowChars = row.title.length + row.content.length;
		if (
			current.length > 0 &&
			(current.length >= BATCH_MAX_ITEMS || chars + rowChars > BATCH_CHAR_CAP)
		) {
			batches.push(current);
			current = [];
			chars = 0;
		}
		current.push(row);
		chars += rowChars;
	}
	if (current.length > 0) batches.push(current);
	return batches;
}

/** Inclusive [start, end] timestamp window a BriefPeriod covers, or nulls. */
function periodBounds(period: BriefPeriod): {
	start: Date | null;
	end: Date | null;
} {
	const now = new Date();
	if (period === "all") return { start: null, end: null };
	const days = period === "today" ? 1 : period === "week" ? 7 : 30;
	const start = new Date(now.getTime() - days * 86_400_000);
	return { start, end: now };
}
