import {
	Body,
	Controller,
	Get,
	Inject,
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
}
