import {
	Body,
	Controller,
	Get,
	Inject,
	NotFoundException,
	Param,
	Post,
	Query,
} from "@nestjs/common";
import type { BriefPeriod, PeriodSummary } from "@vorynth/types";
import { IntelligenceService } from "./intelligence.service.js";

/**
 * Intelligence / Report endpoints.
 *
 *   POST /reports/generate              run the LangGraph pipeline (only when an
 *                                       LLM is configured). Accepts {period} so
 *                                       you can analyze "today" / "week" / "month".
 *   GET  /reports/today                 today-scoped feed, enriched.
 *   GET  /reports/range?period=         ranked feed filtered to a period.
 *   POST /reports/summarize?period=     ONE cohesive LLM briefing over a period.
 *   GET  /insights/:id                  a single AI insight (detail view).
 *   POST /articles/:id/translate       translate one story in place (reader button).
 *   POST /articles/:id/insight         generate one story's AI insight on demand
 *                                      (brief card button; 400 when no LLM or the
 *                                      story has no body text).
 *
 * `period` is one of: today | week | month | all.
 */
@Controller()
export class IntelligenceController {
	constructor(
		@Inject(IntelligenceService)
		private readonly intelligence: IntelligenceService,
	) {}

	@Post("reports/generate")
	async generate(
		@Body()
		body: { targetLanguage?: string; cap?: number; period?: BriefPeriod } = {},
	) {
		return this.intelligence.generate({
			targetLanguage: body.targetLanguage,
			cap: body.cap,
			period: body.period ?? "all",
		});
	}

	@Get("reports/today")
	async today() {
		return this.intelligence.today();
	}

	@Get("reports/range")
	async range(@Query("period") period?: string) {
		return this.intelligence.getRange((period as BriefPeriod) ?? "all");
	}

	@Post("reports/summarize")
	async summarize(
		@Query("period") period?: string,
		@Body() body: { targetLanguage?: string; limit?: number } = {},
	): Promise<PeriodSummary | { ok: false; reason: string }> {
		const result = await this.intelligence.summarizePeriod({
			period: (period as BriefPeriod) ?? "week",
			targetLanguage: body.targetLanguage,
			limit: body.limit,
		});
		if (!result) {
			return {
				ok: false,
				reason: "No LLM provider configured. Add one in Settings.",
			};
		}
		return result;
	}

	@Get("insights/:id")
	async getInsight(@Param("id") id: string) {
		return this.intelligence.getInsight(id);
	}

	@Post("articles/:id/translate")
	async translateArticle(
		@Param("id") id: string,
		@Body() body: { force?: boolean } = {},
	) {
		const detail = await this.intelligence.translateStory(id, {
			force: body.force === true,
		});
		if (!detail) {
			throw new NotFoundException(`Article ${id} not found`);
		}
		return detail;
	}

	/** v1.8.0 — generate one story's AI insight on demand (brief card button). */
	@Post("articles/:id/insight")
	async generateArticleInsight(@Param("id") id: string) {
		return this.intelligence.generateInsight(id);
	}

	/**
	 * v1.8.0 — per-story Re-collect: re-fetch the origin, refresh the full
	 * text, repair a stale/incomplete translation, and fill a missing insight
	 * (the Re-collect button next to Save).
	 */
	@Post("articles/:id/recollect")
	async recollectArticle(@Param("id") id: string) {
		const detail = await this.intelligence.recollectStory(id);
		if (!detail) {
			throw new NotFoundException(`Article ${id} not found`);
		}
		return detail;
	}
}
