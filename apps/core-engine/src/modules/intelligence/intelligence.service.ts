import {
	BadRequestException,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import { eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { DatabaseService } from "../../db/database.service.js";
import { aiInsights, articleClusters, userProfile } from "../../db/schema.js";
import type {
	ArticleDetail,
	BriefEntry,
	BriefPeriod,
	Insight,
	PeriodSummary,
	TodaysBrief,
} from "@vorynth/types";
import { LlmService } from "../llm/llm.service.js";
import { localizeOriginalDraft } from "../llm/llm-provider.js";
import { NewsService } from "../news/news.service.js";
import { HistoryService } from "../history/history.service.js";
import { CrawlerService } from "../crawler/crawler.service.js";
import { translationIsIncomplete } from "../crawler/content-quality.js";
import { buildIntelligenceGraph } from "./workflows/intelligence.workflow.js";
import { titleNeedsTranslation } from "./title-script.js";
import {
	buildSummaryPrompt,
	parseSummaryDraft,
} from "./prompts/summary.prompt.js";
import {
	buildInsightOnlyPrompt,
	buildTranslationPrompt,
	parseInsightOnly,
	parseTranslationBatch,
	type InsightTranslationText,
	type ParsedTranslation,
} from "./prompts/translation.prompt.js";
import { extractCitedNumbers, resolveCitations } from "./prompts/citations.js";
import { tierFor } from "./nodes/tier.js";
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
		@Inject(CrawlerService) private readonly crawler: CrawlerService,
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

		// v1.8.0 — the ORIGINAL version's language: the user's explicit setting,
		// or "auto" = the majority language of the stories in this summary
		// (untagged stories weight "en").
		const originalSetting = this.history.getSetting<string>(
			"intelligence.summaryOriginalLanguage",
			"auto",
		);
		let originalLanguage: string;
		if (originalSetting && originalSetting.toLowerCase() !== "auto") {
			originalLanguage = originalSetting.toLowerCase();
		} else {
			const counts = new Map<string, number>();
			for (const e of entries) {
				const lang = (e.article.language ?? "en").toLowerCase();
				counts.set(lang, (counts.get(lang) ?? 0) + 1);
			}
			let best = "en";
			let bestCount = 0;
			for (const [lang, c] of counts) {
				if (c > bestCount) {
					best = lang;
					bestCount = c;
				}
			}
			originalLanguage = best;
		}
		// When the majority language already IS the user's language, there is no
		// separate original — the summary is single-language.
		const bilingual =
			originalLanguage.toLowerCase() !== targetLanguage.toLowerCase();

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
			originalLanguage: bilingual ? originalLanguage : undefined,
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

		// Resolve [N] markers across EVERY generated string (both the translated
		// and, when bilingual, the original version) → one shared Citation set.
		const citedNumbers = extractCitedNumbers(
			draft.headline,
			...draft.takeaways,
			...draft.recommendedActions,
			...draft.themes.map((t) => t.rationale),
		);
		const originalCitedNumbers =
			bilingual && draft.originalHeadline
				? extractCitedNumbers(
						draft.originalHeadline,
						...(draft.originalTakeaways ?? []),
						...(draft.originalRecommendedActions ?? []),
						...(draft.originalThemes ?? []).map((t) => t.rationale),
					)
				: [];
		const citations = resolveCitations(
			[...new Set([...citedNumbers, ...originalCitedNumbers])],
			context,
		);

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
		// The original version's themes — fall back to the (language-neutral)
		// category themes when the model left them empty.
		const originalThemes: PeriodSummary["themes"] =
			draft.originalThemes && draft.originalThemes.length > 0
				? draft.originalThemes.map((t) => ({
						name: t.name,
						rationale: t.rationale,
					}))
				: themes;

		const headline =
			draft.headline ||
			`${entries.length} stories across ${themes.length} themes this ${period}.`;
		const summary: PeriodSummary = {
			period,
			headline,
			themes,
			takeaways: draft.takeaways,
			recommendedActions: draft.recommendedActions,
			citations,
			storyCount: entries.length,
			...(bilingual && draft.originalHeadline
				? {
						originalLanguage,
						originalHeadline: draft.originalHeadline,
						originalThemes,
						originalTakeaways: draft.originalTakeaways ?? [],
						originalRecommendedActions: draft.originalRecommendedActions ?? [],
					}
				: {}),
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
		const lang = targetLanguage ?? (await this.readIntelligenceLanguage());

		// Fail the job with a clear reason instead of silently "regenerating" 0
		// insights when no usable AI provider exists.
		if (!(await this.llm.isAvailable())) {
			throw this.llm.unavailableException();
		}

		// Fetch all insights that have an associated article, joined so we
		// can filter to those whose article still exists.
		const rows = this.db.rawDb
			.prepare(
				`SELECT i.id AS insightId, i.article_id AS articleId,
				        a.title AS articleTitle, a.content AS articleContent,
				        s.language AS source_language,
				        i.generated_language AS currentLanguage
				 FROM ai_insights i
				 INNER JOIN articles a ON a.id = i.article_id
				 LEFT JOIN sources s ON s.id = a.source_id
				 WHERE i.article_id IS NOT NULL`,
			)
			.all() as Array<{
			insightId: string;
			articleId: string;
			articleTitle: string;
			articleContent: string;
			source_language: string | null;
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
			     original_summary = ?, original_significance = ?,
			     original_impact = ?, original_recommended_action = ?,
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
				// v1.8.0 — bilingual generation: the regenerated analysis also
				// comes back in the story's source language (the `original*`),
				// so the fresh insight keeps both versions.
				// v1.8.1 — `localizeOriginalDraft` drops same-language "originals"
				// (auto-detected on untagged sources) and empty fields.
				const draft = localizeOriginalDraft(
					await this.llm.analyze({
						articleTitle: row.articleTitle,
						articleContent: row.articleContent,
						outputLanguage: lang,
						sourceLanguage: row.source_language ?? undefined,
					}),
					lang,
				);

				updateStmt.run(
					draft.significance,
					draft.impact,
					draft.recommendedAction,
					draft.originalSummary ?? null,
					draft.originalSignificance ?? null,
					draft.originalImpact ?? null,
					draft.originalRecommendedAction ?? null,
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
	 * Whether an LLM provider is configured (API key present). Gates
	 * auto-translation after collect: News mode has no key, so nothing is
	 * queued (R-A03 — LLM is an enhancement, never a hard dependency).
	 */
	async canTranslate(): Promise<boolean> {
		return this.llm.isAvailable();
	}

	/**
	 * v1.8.1 — whether AUTO-analysis may run after a collect: Intelligence
	 * mode ON plus a configured provider. News mode never spends tokens, even
	 * when a key happens to be configured (R-A03).
	 */
	async canAutoAnalyze(): Promise<boolean> {
		return this.llm.getMode() === "intelligence" && this.llm.isAvailable();
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
		opts?: { retranslateAll?: boolean },
	): Promise<number> {
		const lang = (
			targetLanguage ?? (await this.readIntelligenceLanguage())
		).toLowerCase();

		// Fail the job with a clear reason instead of silently "translating" 0
		// stories when no usable AI provider exists.
		if (!(await this.llm.isAvailable())) {
			throw this.llm.unavailableException();
		}

		// `retranslateAll` (v1.8.0): the user changed their intelligence
		// language — re-translate EVERY story that's currently in a different
		// language, not just the untranslated ones. Existing translations were
		// made from the ORIGINAL title/body, so the WHERE clause changes from
		// "no translation yet" to "source language differs" — translated bodies
		// are included and rewritten into the new language from the original.
		const whereClause = opts?.retranslateAll
			? `WHERE a.content != ''
			   AND (s.language IS NULL OR lower(s.language) != lower(?))
			   ORDER BY a.collected_at DESC`
			: `WHERE a.content != ''
			   AND (a.translated_content IS NULL OR a.translated_content = '')
			   AND (s.language IS NULL OR lower(s.language) != lower(?))
			   ORDER BY a.collected_at DESC`;

		const rows = (
			this.db.rawDb
				.prepare(
					`SELECT a.id, a.title, a.content, a.author, a.original_title,
					        i.summary  AS insight_summary,
					        i.significance AS insight_significance,
					        i.impact AS insight_impact,
					        i.recommended_action AS insight_recommended_action
					 FROM articles a
					 JOIN sources s ON s.id = a.source_id
					 LEFT JOIN ai_insights i ON i.article_id = a.id
					 ${whereClause}`,
				)
				.all(lang) as Array<{
				id: string;
				title: string;
				content: string;
				author: string | null;
				original_title: string | null;
				insight_summary: string | null;
				insight_significance: string | null;
				insight_impact: string | null;
				insight_recommended_action: string | null;
			}>
		)
			.map((r) => ({
				id: r.id,
				title: r.title,
				content: r.content,
				author: r.author,
				original_title: r.original_title,
				// The story's AI insight rides along into the target language
				// (v1.8.0) — present only when the story actually has one.
				insight: r.insight_summary
					? {
							summary: r.insight_summary,
							significance: r.insight_significance ?? "",
							impact: r.insight_impact ?? "",
							recommendedAction: r.insight_recommended_action ?? "",
						}
					: null,
			}))
			// v1.8.1 — script filter: untagged sources whose title is already
			// written in the target language's script don't need a translation
			// either (same-language "translations" garble meaning). Latin targets
			// are unaffected.
			.filter((r) => titleNeedsTranslation(r.original_title ?? r.title, lang));

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
		const insightStmt = this.db.rawDb.prepare(
			`UPDATE ai_insights SET
			   summary = ?, significance = ?, impact = ?, recommended_action = ?,
			   original_summary = CASE
			     WHEN original_summary IS NULL OR original_summary = '' THEN ?
			     ELSE original_summary END,
			   original_significance = CASE
			     WHEN original_significance IS NULL OR original_significance = '' THEN ?
			     ELSE original_significance END,
			   original_impact = CASE
			     WHEN original_impact IS NULL OR original_impact = '' THEN ?
			     ELSE original_impact END,
			   original_recommended_action = CASE
			     WHEN original_recommended_action IS NULL OR original_recommended_action = '' THEN ?
			     ELSE original_recommended_action END,
			   generated_language = ?
			 WHERE article_id = ?`,
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
				// The story's insight follows the same language change — write
				// the translated analysis (and stamp its new language) only when
				// the story has one AND the model returned it. A field the model
				// left empty keeps its existing value (never overwrite real text
				// with nothing — R-C04).
				if (hit.insight && row.insight) {
					insightStmt.run(
						hit.insight.summary || row.insight.summary,
						hit.insight.significance || row.insight.significance,
						hit.insight.impact || row.insight.impact,
						hit.insight.recommendedAction || row.insight.recommendedAction,
						// The ORIGINAL insight (v1.8.0): captured from the stored
						// text on the first translation, kept forever after —
						// mirrors how `original_title` preserves the source title.
						row.insight.summary,
						row.insight.significance,
						row.insight.impact,
						row.insight.recommendedAction,
						lang,
						row.id,
					);
				}
				// Keep the FTS index in sync with the rewritten title (content
				// is unchanged by this job). The ORIGINAL title — `row.title`
				// before this write, or a pre-existing `original_title` from a
				// prior language change — stays searchable alongside it.
				ftsUpdateArticle(
					this.db.rawDb,
					row.id,
					hit.title,
					row.content,
					row.author,
					row.original_title || row.title,
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
	 * Translate ONE story's title AND body into the user's intelligence
	 * language, on demand from the reader's Translate button (v1.8.0).
	 *
	 * Reuses the exact prompt + parser + write path of `translateAllStories`
	 * (same UPDATE, same `original_title` preservation, same FTS re-sync), so a
	 * story translated individually is indistinguishable from one translated by
	 * the batch job. Idempotent: a story with an empty body or an existing
	 * translation is returned untouched. An LLM failure is rethrown so the UI
	 * can surface it — the story simply stays untranslated.
	 *
	 * `force` (v1.8.0 re-translate): skip the fully-translated guard and
	 * re-translate even when a translation already exists (used by the
	 * Re-translate pill for incomplete translations and the health check).
	 *
	 * @returns The refreshed `ArticleDetail`, or `null` when the article doesn't exist.
	 */
	async translateStory(
		id: string,
		opts?: { force?: boolean },
	): Promise<ArticleDetail | null> {
		const row = this.db.rawDb
			.prepare(
				`SELECT a.id, a.title, a.content, a.author, a.translated_content,
				        a.original_title, s.language AS source_language,
				        i.summary  AS insight_summary,
				        i.significance AS insight_significance,
				        i.impact AS insight_impact,
				        i.recommended_action AS insight_recommended_action
				 FROM articles a
				 JOIN sources s ON s.id = a.source_id
				 LEFT JOIN ai_insights i ON i.article_id = a.id
				 WHERE a.id = ?`,
			)
			.get(id) as
			| {
					id: string;
					title: string;
					content: string;
					author: string | null;
					translated_content: string | null;
					original_title: string | null;
					source_language: string | null;
					insight_summary: string | null;
					insight_significance: string | null;
					insight_impact: string | null;
					insight_recommended_action: string | null;
			  }
			| undefined;
		if (!row) return null;

		const lang = (await this.readIntelligenceLanguage()).toLowerCase();

		// Same-language guard (v1.8.0): a story whose SOURCE is already in the
		// user's intelligence language is never translated — the old behavior
		// sent an English story through an English "translation" and rewrote its
		// title with a near-identical copy (the "broken" feel after a language
		// change). Untagged sources (no language set) keep translating.
		if (row.source_language && row.source_language.toLowerCase() === lang) {
			return this.news.getArticleDetail(id);
		}

		// v1.8.1 — script guard: even when the source is untagged, a title
		// already written in the target language's script (e.g. a Persian title
		// with the intelligence language set to Persian) doesn't need a
		// translation — same-language "translations" garble the meaning. Latin
		// targets are unaffected (the heuristic only covers distinctive scripts).
		if (!titleNeedsTranslation(row.original_title || row.title, lang)) {
			return this.news.getArticleDetail(id);
		}

		// "Fully translated" = the title carries a translation AND there is no
		// body left to translate (body empty or body translated). A story whose
		// title was translated but whose body wasn't (legacy title-only job) and
		// a story with a title but no body text both still proceed — mirroring
		// the brief/reader pill, which stays visible until the title is done.
		const titleTranslated = (row.original_title ?? "") !== "";
		const hasBody = row.content.trim() !== "";
		const bodyTranslated = (row.translated_content ?? "") !== "";
		const needsTranslation = !titleTranslated || (hasBody && !bodyTranslated);
		if (!opts?.force && !needsTranslation) {
			return this.news.getArticleDetail(id);
		}

		// Translate from the ORIGINAL title, not a previous translation: after a
		// language change `row.title` holds the old-language title and
		// `original_title` the true source — translating from the translated
		// title garbles the re-translation.
		const sourceTitle = row.original_title || row.title;
		// The story's AI insight rides along into the target language (v1.8.0).
		const insight: InsightTranslationText | null = row.insight_summary
			? {
					summary: row.insight_summary,
					significance: row.insight_significance ?? "",
					impact: row.insight_impact ?? "",
					recommendedAction: row.insight_recommended_action ?? "",
				}
			: null;

		// Very long bodies make the model cut corners — it translates the title
		// and the beginning of the body but then returns the rest (and the
		// insight) unchanged or truncated. Split the content into chunks and send
		// ONE request per chunk (title + insight ride on the first chunk), then
		// stitch the translated chunks back together. Each request stays short
		// enough for the model to translate everything faithfully (v1.8.0).
		const chunks = splitContent(row.content);

		const firstChunk = chunks[0] ?? "";
		const { system, user } = buildTranslationPrompt({
			targetLanguage: lang,
			items: [
				{
					id: row.id,
					title: sourceTitle,
					content: firstChunk,
					insight,
				},
			],
		});

		try {
			const raw = await this.llm.generate({
				system,
				user,
				outputLanguage: lang,
			});
			const hit = parseTranslationBatch(raw).find((p) => p.id === id);
			if (!hit) {
				this.logger.warn(
					`translateStory: model returned no entry for ${id} — nothing written`,
				);
				return this.news.getArticleDetail(id);
			}

			// Translate the remaining chunks (body only — the title and insight
			// were already handled on the first chunk). A chunk that comes back
			// unparseable keeps its source text (never drop content — R-C04).
			let translatedBody = hit.content;
			if (chunks.length > 1) {
				const rest = chunks.slice(1);
				for (const chunk of rest) {
					const { system: sys2, user: user2 } = buildTranslationPrompt({
						targetLanguage: lang,
						items: [
							{
								id: row.id,
								title: sourceTitle,
								content: chunk,
							},
						],
					});
					const raw2 = await this.llm.generate({
						system: sys2,
						user: user2,
						outputLanguage: lang,
					});
					const hit2 = parseTranslationBatch(raw2).find((p) => p.id === id);
					translatedBody += hit2?.content ?? chunk;
				}
			}
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
			// Only write a body translation when there's a body to translate —
			// a title-only story (empty body) must never gain a fabricated body
			// the model invented from nothing (R-C04).
			updateStmt.run(hit.title, row.title, hasBody ? translatedBody : null, id);
			// The story's insight follows the same language change — write the
			// translated analysis (and stamp its new language) only when the
			// story has one AND the model returned it. A field the model left
			// empty keeps its existing value (never overwrite real text with
			// nothing — R-C04). The ORIGINAL insight is captured from the stored
			// text on the first translation (v1.8.0) — mirrors the article's
			// `original_title` — so the reader can show both.
			if (insight) {
				// On very long articles (15K+ chars of body) the model sometimes
				// returns the insight in the WRONG language — the title/body come
				// out translated but the insight text stays in its previous
				// language. When that happens, retry the insight on its own: four
				// short fields is a much smaller ask the model completes faithfully.
				// The guard only fires when the target language has an unambiguous
				// script (CJK / RTL) — for Latin languages we can't tell the
				// difference, so we trust the model's output.
				let translated = hit.insight
					? {
							summary: hit.insight.summary || insight.summary,
							significance: hit.insight.significance || insight.significance,
							impact: hit.insight.impact || insight.impact,
							recommendedAction:
								hit.insight.recommendedAction || insight.recommendedAction,
						}
					: null;
				if (
					canDetectLanguage(lang) &&
					translated &&
					!isLikelyLanguage(translated.summary, lang) &&
					!isLikelyLanguage(translated.recommendedAction, lang)
				) {
					this.logger.warn(
						`translateStory: insight came back in the wrong language for ${id} — retrying insight-only`,
					);
					translated = await this.translateInsightOnly(id, insight, lang);
				}
				if (translated) {
					this.writeInsightTranslation(id, insight, translated, lang);
				}
			}
			// Keep the FTS index in sync with the rewritten title (content is
			// unchanged by a translation). The ORIGINAL title stays searchable.
			ftsUpdateArticle(
				this.db.rawDb,
				id,
				hit.title,
				row.content,
				row.author,
				row.original_title || row.title,
			);
			this.logger.log(`translateStory: translated ${id} to "${lang}"`);
		} catch (err) {
			this.logger.warn(
				`translateStory failed for ${id}: ${(err as Error).message}`,
			);
			throw err;
		}
		return this.news.getArticleDetail(id);
	}

	/**
	 * Translate ONLY a story's AI insight into the target language (v1.8.0).
	 *
	 * Fallback for the case where the main story-translation pass returned the
	 * insight in its previous language (very long bodies make the model
	 * occasionally skip the insight). Four short fields is a small, reliable
	 * ask. Returns null when the model fails or returns nothing usable.
	 */
	private async translateInsightOnly(
		id: string,
		insight: InsightTranslationText,
		lang: string,
	): Promise<InsightTranslationText | null> {
		const { system, user } = buildInsightOnlyPrompt({
			targetLanguage: lang,
			id,
			insight,
		});
		try {
			const raw = await this.llm.generate({
				system,
				user,
				outputLanguage: lang,
			});
			const parsed = parseInsightOnly(raw);
			if (!parsed) {
				this.logger.warn(
					`translateInsightOnly: model returned nothing usable for ${id}`,
				);
				return null;
			}
			// Guard against the model returning the old language again — if so,
			// report failure rather than stamping a wrong-language insight.
			if (!isLikelyLanguage(parsed.summary, lang)) {
				this.logger.warn(
					`translateInsightOnly: still not in "${lang}" for ${id} — keeping existing insight`,
				);
				return null;
			}
			return parsed;
		} catch (err) {
			this.logger.warn(
				`translateInsightOnly failed for ${id}: ${(err as Error).message}`,
			);
			return null;
		}
	}

	/**
	 * Persist a translated insight, preserving the ORIGINAL (pre-translation)
	 * text on the first translation (v1.8.0) — mirrors the article's
	 * `original_title` — so the reader can show both.
	 */
	private writeInsightTranslation(
		id: string,
		source: InsightTranslationText,
		translated: InsightTranslationText,
		lang: string,
	): void {
		this.db.rawDb
			.prepare(
				`UPDATE ai_insights SET
				   summary = ?, significance = ?, impact = ?, recommended_action = ?,
				   original_summary = CASE
				     WHEN original_summary IS NULL OR original_summary = '' THEN ?
				     ELSE original_summary END,
				   original_significance = CASE
				     WHEN original_significance IS NULL OR original_significance = '' THEN ?
				     ELSE original_significance END,
				   original_impact = CASE
				     WHEN original_impact IS NULL OR original_impact = '' THEN ?
				     ELSE original_impact END,
				   original_recommended_action = CASE
				     WHEN original_recommended_action IS NULL OR original_recommended_action = '' THEN ?
				     ELSE original_recommended_action END,
				   generated_language = ?
				 WHERE article_id = ?`,
			)
			.run(
				translated.summary,
				translated.significance,
				translated.impact,
				translated.recommendedAction,
				source.summary,
				source.significance,
				source.impact,
				source.recommendedAction,
				lang,
				id,
			);
	}

	/**
	 * Data-health translation repair (v1.8.0): re-translate articles whose body
	 * translation went stale when the health check upgraded their origin from a
	 * snippet to the full text. When Intelligence mode is on each story is
	 * re-translated (the shared rate limiter paces it); in news mode (no LLM)
	 * the stale body translation is cleared so the UI never shows a partial
	 * snippet-translation as the body of the now-full article (R-A05/R-C04) —
	 * the per-story Translate pill reappears instead.
	 */
	async repairStaleTranslations(
		ids: string[],
		onProgress?: (done: number, total: number) => void,
		throwIfCanceled?: () => void,
	): Promise<{ retranslated: number; cleared: number }> {
		if (ids.length === 0) return { retranslated: 0, cleared: 0 };
		const lang = await this.readIntelligenceLanguage();
		const llmAvailable = await this.llm.isAvailable();
		const clearStmt = this.db.rawDb.prepare(
			"UPDATE articles SET translated_content = NULL WHERE id = ?",
		);
		const updateStmt = this.db.rawDb.prepare(
			"UPDATE articles SET translated_content = ? WHERE id = ?",
		);
		let retranslated = 0;
		let cleared = 0;
		let done = 0;

		for (const id of ids) {
			throwIfCanceled?.();
			const row = this.db.rawDb
				.prepare("SELECT id, title, content FROM articles WHERE id = ?")
				.get(id) as { id: string; title: string; content: string } | undefined;
			if (!row) {
				done += 1;
				onProgress?.(done, ids.length);
				continue;
			}
			if (!llmAvailable) {
				clearStmt.run(id);
				cleared += 1;
				done += 1;
				onProgress?.(done, ids.length);
				continue;
			}
			try {
				const { system, user } = buildTranslationPrompt({
					targetLanguage: lang,
					items: [{ id: row.id, title: row.title, content: row.content }],
				});
				const raw = await this.llm.generate({
					system,
					user,
					outputLanguage: lang,
				});
				const hit = parseTranslationBatch(raw).find((p) => p.id === id);
				if (hit) {
					updateStmt.run(hit.content ?? null, id);
					retranslated += 1;
				}
			} catch (err) {
				this.logger.warn(
					`health re-translate failed for ${id}: ${(err as Error).message}`,
				);
			}
			done += 1;
			onProgress?.(done, ids.length);
		}

		this.logger.log(
			`health translation repair: ${retranslated} re-translated, ${cleared} cleared (${ids.length} stale)`,
		);
		return { retranslated, cleared };
	}

	/**
	 * Data-health translation completeness pass (v1.8.0): re-translate stories
	 * whose stored body translation is detected as incomplete — leftover
	 * placeholders, `\uXXXX` escapes, or implausibly short vs the origin (see
	 * `translationIsIncomplete`). In Intelligence mode each is force
	 * re-translated (rate-limited, cancelable); in news mode the bad
	 * translation is cleared so the Translate pill reappears instead of showing
	 * a truncated body (R-C04). Capped per run like the other health passes.
	 *
	 * @returns `{ retranslated: number; cleared: number }`
	 */
	async repairIncompleteTranslations(
		onProgress?: (done: number, total: number) => void,
		throwIfCanceled?: () => void,
		cap = 100,
	): Promise<{ retranslated: number; cleared: number }> {
		const rows = this.db.rawDb
			.prepare(
				`SELECT id FROM articles
				 WHERE translated_content IS NOT NULL AND translated_content != ''
				   AND content != ''
				 ORDER BY collected_at DESC
				 LIMIT ?`,
			)
			.all(cap) as Array<{ id: string }>;
		const incomplete = rows.filter((r) => {
			const row = this.db.rawDb
				.prepare(
					"SELECT content, translated_content FROM articles WHERE id = ?",
				)
				.get(r.id) as {
				content: string;
				translated_content: string | null;
			};
			return translationIsIncomplete(row.content, row.translated_content);
		});
		if (incomplete.length === 0) return { retranslated: 0, cleared: 0 };

		const llmAvailable = await this.llm.isAvailable();
		let retranslated = 0;
		let cleared = 0;
		let done = 0;

		for (const { id } of incomplete) {
			throwIfCanceled?.();
			if (!llmAvailable) {
				this.db.rawDb
					.prepare("UPDATE articles SET translated_content = NULL WHERE id = ?")
					.run(id);
				cleared += 1;
				done += 1;
				onProgress?.(done, incomplete.length);
				continue;
			}
			try {
				await this.translateStory(id, { force: true });
				retranslated += 1;
			} catch (err) {
				this.logger.warn(
					`health incomplete-translation repair failed for ${id}: ${(err as Error).message}`,
				);
			}
			done += 1;
			onProgress?.(done, incomplete.length);
		}

		this.logger.log(
			`health translation completeness: ${retranslated} re-translated, ${cleared} cleared (${incomplete.length} incomplete)`,
		);
		return { retranslated, cleared };
	}

	/**
	 * Per-story Re-collect (v1.8.0): run the full repair pipeline for ONE
	 * article — re-fetch the origin and refresh the full text, re-translate (or
	 * honestly clear) a body translation that went stale when the origin
	 * changed, then fill a missing AI insight. This is the health check scoped
	 * to a single story, driven by the Re-collect button next to Save.
	 *
	 * @returns The refreshed `ArticleDetail`, or `null` when the article doesn't exist.
	 */
	async recollectStory(articleId: string): Promise<ArticleDetail | null> {
		const { changed, hadTranslation } =
			await this.crawler.recollectArticleContent(articleId);

		if (changed && hadTranslation) {
			// The origin changed under an existing body translation — repair it
			// (re-translate when an LLM is on, clear when in news mode) so the
			// reader never shows a translation of the old snippet.
			await this.repairStaleTranslations([articleId]);
		}

		// A freshly-upgraded body may now be analyzable. Idempotent, and its
		// guards make this a no-op in news mode / for empty bodies — a skipped
		// insight must not fail the re-collect.
		try {
			await this.generateInsight(articleId);
		} catch (err) {
			this.logger.log(
				`recollectStory: insight skipped for ${articleId}: ${(err as Error).message}`,
			);
		}

		return this.news.getArticleDetail(articleId);
	}

	/**
	 * Data-health insight backfill (v1.8.0): analyze content-bearing articles
	 * that have no AI insight yet (Why It Matters / Impact / Recommended
	 * Action). Only runs when Intelligence mode is on — news mode never spends
	 * tokens. Rate-limited and cancelable; capped per run so a large library
	 * heals across a few daily runs instead of one giant burst.
	 *
	 * @returns Number of insights generated.
	 */
	async backfillMissingInsights(
		onProgress?: (done: number, total: number) => void,
		throwIfCanceled?: () => void,
		cap = 100,
	): Promise<number> {
		if (!(await this.llm.isAvailable())) return 0;
		const lang = await this.readIntelligenceLanguage();

		const rows = this.db.rawDb
			.prepare(
				`SELECT a.id AS articleId, a.title AS articleTitle, a.content AS articleContent,
				        s.language AS source_language
				 FROM articles a JOIN sources s ON s.id = a.source_id
				 WHERE a.content != ''
				   AND NOT EXISTS (SELECT 1 FROM ai_insights i WHERE i.article_id = a.id)
				 ORDER BY a.collected_at DESC
				 LIMIT ?`,
			)
			.all(cap) as Array<{
			articleId: string;
			articleTitle: string;
			articleContent: string;
			source_language: string | null;
		}>;

		const total = rows.length;
		let done = 0;
		let generated = 0;

		for (const row of rows) {
			throwIfCanceled?.();
			try {
				// v1.8.1 — bilingual generation for the backfill too: pass the
				// source language (auto-detected when untagged) and keep the
				// `original*` versions, so every backfilled insight carries both.
				const draft = localizeOriginalDraft(
					await this.llm.analyze({
						articleTitle: row.articleTitle,
						articleContent: row.articleContent,
						outputLanguage: lang,
						sourceLanguage: row.source_language ?? undefined,
					}),
					lang,
				);
				const score = draft.importanceScore || 0;
				await this.persist(
					[
						{
							articleId: row.articleId,
							clusterId: randomUUID(),
							summary: draft.summary,
							significance: draft.significance,
							impact: draft.impact,
							recommendedAction: draft.recommendedAction,
							importanceScore: score,
							importanceTier: tierFor(score),
							category: draft.category || "other",
							originalSummary: draft.originalSummary,
							originalSignificance: draft.originalSignificance,
							originalImpact: draft.originalImpact,
							originalRecommendedAction: draft.originalRecommendedAction,
						},
					],
					lang,
				);
				generated += 1;
			} catch (err) {
				this.logger.warn(
					`health insight backfill failed for "${row.articleTitle}": ${(err as Error).message}`,
				);
			}
			done += 1;
			onProgress?.(done, total);
		}

		this.logger.log(
			`health insight backfill: ${generated}/${total} insights generated`,
		);
		return generated;
	}

	/** Count of content-bearing articles with no insight (health-check progress). */
	missingInsightCount(): number {
		const { c } = this.db.rawDb
			.prepare(
				"SELECT COUNT(*) AS c FROM articles a WHERE a.content != '' AND NOT EXISTS (SELECT 1 FROM ai_insights i WHERE i.article_id = a.id)",
			)
			.get() as { c: number };
		return c;
	}

	/**
	 * Generate ONE article's AI insight on demand (v1.8.0) — the brief card's
	 * "Generate" button for a story whose analysis hasn't run yet.
	 *
	 * Guards: Intelligence mode must be on (an LLM provider exists), the article
	 * must exist, and it must have a body to analyze — an empty-body story can't
	 * be analyzed, so the UI shows the reason instead of the button. Idempotent:
	 * an insight that appeared since the card rendered is returned untouched.
	 * Rate-limited through the shared LLM limiter like every other analyze call.
	 */
	async generateInsight(articleId: string): Promise<Insight> {
		if (!(await this.llm.isAvailable())) {
			throw new BadRequestException({
				code: "INSIGHT_LLM_UNAVAILABLE",
				message:
					"Insight generation needs Intelligence mode and an LLM provider — switch modes or add one in Settings.",
			});
		}
		const row = this.db.rawDb
			.prepare(
				`SELECT a.id, a.title, a.content, s.language AS source_language
				 FROM articles a JOIN sources s ON s.id = a.source_id
				 WHERE a.id = ?`,
			)
			.get(articleId) as
			| {
					id: string;
					title: string;
					content: string;
					source_language: string | null;
			  }
			| undefined;
		if (!row) throw new NotFoundException(`article ${articleId} not found`);
		if (!row.content.trim()) {
			throw new BadRequestException({
				code: "INSIGHT_NO_CONTENT",
				message:
					"This story has no body text, so Vorynth can't analyze it. Re-collect the source to fetch the full article first.",
			});
		}

		// Idempotent — never regenerate an insight that already exists.
		const existing = await this.db.db
			.select()
			.from(aiInsights)
			.where(eq(aiInsights.articleId, articleId))
			.limit(1)
			.get();
		if (existing) return toInsightDto(existing);

		const lang = await this.readIntelligenceLanguage();
		// v1.8.0 — bilingual generation: the same request also returns the
		// analysis in the story's source language (stored as `original*`), so
		// every new insight carries both versions for display and export.
		// v1.8.1 — untagged sources auto-detect: `localizeOriginalDraft` drops
		// the "original" when the article is already in the output language.
		const draft = localizeOriginalDraft(
			await this.llm.analyze({
				articleTitle: row.title,
				articleContent: row.content,
				outputLanguage: lang,
				sourceLanguage: row.source_language ?? undefined,
			}),
			lang,
		);
		const score = draft.importanceScore || 0;
		const [created] = await this.persist(
			[
				{
					articleId,
					clusterId: randomUUID(),
					summary: draft.summary,
					significance: draft.significance,
					impact: draft.impact,
					recommendedAction: draft.recommendedAction,
					importanceScore: score,
					importanceTier: tierFor(score),
					category: draft.category || "other",
					originalSummary: draft.originalSummary,
					originalSignificance: draft.originalSignificance,
					originalImpact: draft.originalImpact,
					originalRecommendedAction: draft.originalRecommendedAction,
				},
			],
			lang,
		);

		// "Generate" makes the story whole for the reader: with the insight in
		// hand, also translate the story into the intelligence language (v1.8.0).
		// Idempotent — translateStory skips stories already fully translated. A
		// translation failure never fails the insight: the insight was the point
		// of the click, and the Translate pill stays for the user to retry.
		try {
			await this.translateStory(articleId);
		} catch (err) {
			this.logger.warn(
				`generateInsight: insight created but story translation failed for ${articleId}: ${(err as Error).message}`,
			);
		}

		return toInsightDto(created!);
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
			originalSummary?: string;
			originalSignificance?: string;
			originalImpact?: string;
			originalRecommendedAction?: string;
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
			// v1.8.0 — the source-language version from bilingual generation.
			originalSummary: i.originalSummary ?? null,
			originalSignificance: i.originalSignificance ?? null,
			originalImpact: i.originalImpact ?? null,
			originalRecommendedAction: i.originalRecommendedAction ?? null,
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
	originalSummary: string | null;
	originalSignificance: string | null;
	originalImpact: string | null;
	originalRecommendedAction: string | null;
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
		originalSummary: row.originalSummary,
		originalSignificance: row.originalSignificance,
		originalImpact: row.originalImpact,
		originalRecommendedAction: row.originalRecommendedAction,
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
	original_title: string | null;
	/** The story's AI insight (v1.8.0) — translated alongside title/body. */
	insight: InsightTranslationText | null;
}

/** Greedy chunking: at most `BATCH_MAX_ITEMS` stories and `BATCH_CHAR_CAP` chars per batch. */
function chunkForTranslation(rows: TranslationRow[]): TranslationRow[][] {
	const batches: TranslationRow[][] = [];
	let current: TranslationRow[] = [];
	let chars = 0;
	for (const row of rows) {
		const insightChars = row.insight
			? row.insight.summary.length +
				row.insight.significance.length +
				row.insight.impact.length +
				row.insight.recommendedAction.length
			: 0;
		const rowChars = row.title.length + row.content.length + insightChars;
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

/**
 * Cheap heuristic: does this text look like it's written in the given ISO
 * language code? Used to detect when the LLM returned an insight in its
 * previous language instead of the requested one (v1.8.0). Latin-script
 * languages (en/de/fr/es/…) can't be told apart by characters alone, so we
 * only answer confidently for scripts that are unambiguous: CJK and
 * RTL scripts. For everything else we return false (don't force a retry) —
 * the heuristic is a guard against the *obvious* wrong-language case, not a
 * full language detector.
 */
function isLikelyLanguage(text: string, lang: string): boolean {
	if (!text) return false;
	const code = lang.toLowerCase();
	// CJK: Japanese hiragana/katakana vs Chinese hanzi vs Korean hangul.
	const jp = /[\u3040-\u30ff]/;
	const ko = /[\uac00-\ud7af]/;
	const zh = /[\u4e00-\u9fff]/;
	if (code === "ja") return jp.test(text);
	if (code === "ko") return ko.test(text);
	if (code === "zh" || code === "zh-cn" || code === "zh-tw") {
		return zh.test(text);
	}
	// RTL scripts: Arabic, Persian, Hebrew, Urdu, …
	if (code === "ar" || code === "fa" || code === "he" || code === "ur") {
		return /[\u0590-\u05ff\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/.test(text);
	}
	return false;
}

/**
 * True when the target language has an unambiguous script we can verify
 * (CJK / RTL). For Latin-script languages (en, de, fr, …) the wrong-language
 * guard can't tell scripts apart, so it stays off and the model's output is
 * trusted (v1.8.0).
 */
function canDetectLanguage(lang: string): boolean {
	switch (lang.toLowerCase()) {
		case "ja":
		case "ko":
		case "zh":
		case "zh-cn":
		case "zh-tw":
		case "ar":
		case "fa":
		case "he":
		case "ur":
			return true;
		default:
			return false;
	}
}

/**
 * Split a story body into translation-sized chunks (v1.8.0).
 *
 * Very long bodies (15K+ chars) make the model cut corners during a
 * translation — it translates the title and the start of the body, then
 * returns the tail and the insight unchanged or truncated. Splitting the
 * content into ~6K-char chunks keeps each LLM request short enough that the
 * model translates everything faithfully. Chunks split on paragraph breaks
 * when possible so the seams read naturally.
 */
const TRANSLATION_CHUNK_CHARS = 6_000;

function splitContent(content: string): string[] {
	const trimmed = content.trim();
	if (!trimmed) return [];
	if (trimmed.length <= TRANSLATION_CHUNK_CHARS) return [trimmed];

	const chunks: string[] = [];
	let rest = trimmed;
	while (rest.length > TRANSLATION_CHUNK_CHARS) {
		// Prefer a paragraph break (or last sentence end) near the limit.
		let cut = rest.lastIndexOf("\n\n", TRANSLATION_CHUNK_CHARS);
		if (cut < TRANSLATION_CHUNK_CHARS / 2) {
			cut = rest.lastIndexOf("\n", TRANSLATION_CHUNK_CHARS);
		}
		if (cut < TRANSLATION_CHUNK_CHARS / 2) {
			cut = rest.lastIndexOf(". ", TRANSLATION_CHUNK_CHARS);
		}
		if (cut < TRANSLATION_CHUNK_CHARS / 2 || cut === -1) {
			cut = TRANSLATION_CHUNK_CHARS;
		}
		chunks.push(rest.slice(0, cut).trim());
		rest = rest.slice(cut).trim();
	}
	if (rest) chunks.push(rest);
	return chunks;
}
