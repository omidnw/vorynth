import {
	Body,
	Controller,
	Get,
	Inject,
	Param,
	Post,
	Query,
} from "@nestjs/common";
import type { BriefPeriod, JobKind } from "@vorynth/types";
import { JobsService } from "./jobs.service.js";
import { CrawlerService } from "../crawler/crawler.service.js";
import { IntelligenceService } from "../intelligence/intelligence.service.js";
import { SearchService } from "../search/search.service.js";

/**
 * Background jobs — long-running operations the user can kick off and then
 * navigate away without losing them.
 *
 *   GET    /jobs              list active + recent jobs
 *   GET    /jobs/:id          poll one job's progress
 *   POST   /jobs/collect      collect from all sources (background)
 *   POST   /jobs/generate     run the LangGraph workflow (background)
 *   POST   /jobs/summarize    write a period summary (background)
 *   POST   /jobs/ask          AI search (RAG, background, rate-limited)
 *   POST   /jobs/regenerate-insights  regenerate AI triad for all insights (background)
 *   POST   /jobs/translate-titles     translate all article titles (background)
 *   POST   /jobs/:id/cancel   cancel a running job
 */
@Controller("jobs")
export class JobsController {
	constructor(
		@Inject(JobsService) private readonly jobs: JobsService,
		@Inject(CrawlerService) private readonly crawler: CrawlerService,
		@Inject(IntelligenceService)
		private readonly intelligence: IntelligenceService,
		@Inject(SearchService) private readonly search: SearchService,
	) {}

	@Get()
	async list() {
		return this.jobs.list();
	}

	@Get(":id")
	async get(@Param("id") id: string) {
		return this.jobs.get(id) ?? { notFound: true };
	}

	@Post("collect")
	async collect(
		@Body()
		body?: {
			force?: boolean;
		},
	) {
		const force = body?.force === true;
		const enabled = await this.crawler.enabledCount();
		return this.jobs.start({
			kind: "collect",
			label: force ? "Re-collecting sources" : "Collecting sources",
			itemsTotal: enabled,
			run: async ({ update }) => {
				const results = await this.crawler.collectAll(
					(info) => {
						update({
							message: `${info.done < info.total ? (force ? "Re-collecting" : "Collecting") : force ? "Re-collected" : "Collected"} ${info.sourceName}…`,
							fraction: info.total > 0 ? info.done / info.total : 1,
							itemsDone: info.done,
							itemsTotal: info.total,
						});
					},
					{ force },
				);
				const total = results.reduce((s, r) => s + r.collected, 0);
				update({
					message: `${force ? "Re-collected" : "Collected"} ${total} articles from ${results.length} sources`,
					fraction: 1,
					itemsDone: results.length,
					itemsTotal: enabled,
				});
				return { sources: results.length, totalCollected: total, results };
			},
		});
	}

	@Post("generate")
	async generate(
		@Body()
		body: { period?: BriefPeriod; cap?: number; targetLanguage?: string } = {},
	) {
		return this.jobs.start({
			kind: "generate",
			label: "Generating intelligence",
			run: async ({ update }) => {
				update({ message: "Running LangGraph workflow…", fraction: 0.2 });
				const result = await this.intelligence.generate({
					period: body.period,
					cap: body.cap,
					targetLanguage: body.targetLanguage,
				});
				update({
					message: `Generated ${result.entries.length} ranked entries`,
					fraction: 1,
					itemsDone: result.entries.length,
				});
				return result;
			},
		});
	}

	@Post("summarize")
	async summarize(
		@Body()
		body: {
			period?: BriefPeriod;
			targetLanguage?: string;
			limit?: number;
		} = {},
	) {
		return this.jobs.start({
			kind: "summarize",
			label: "Summarizing period",
			run: async ({ update }) => {
				update({ message: "Packing context + asking the LLM…", fraction: 0.3 });
				const result = await this.intelligence.summarizePeriod({
					period: body.period,
					targetLanguage: body.targetLanguage,
					limit: body.limit,
				});
				if (!result) {
					return {
						ok: false,
						reason: "No LLM provider configured. Add one in Settings.",
					};
				}
				update({ message: "Done", fraction: 1 });
				return result;
			},
		});
	}

		@Post("ask")
		async ask(
			@Query("q") q: string,
			@Body() body: { periodDays?: number; budget?: number } = {},
		) {
			const question = q ?? "";
			return this.jobs.start({
				kind: "summarize" as JobKind, // reuse the "ask LLM" kind for rate-limit dedup
				label: `Asking AI: "${question.slice(0, 40)}${question.length > 40 ? "…" : ""}"`,
				run: async ({ update }) => {
					update({
						message: "Searching articles + asking the LLM…",
						fraction: 0.3,
					});
					const result = await this.search.ask(question, {
						periodMs: body.periodDays ? body.periodDays * 86_400_000 : undefined,
						contextTokenBudget: body.budget,
					});
					update({ message: "Done", fraction: 1 });
					return result;
				},
			});
		}

		@Post("regenerate-insights")
		async regenerateInsights(
			@Body()
			body: { targetLanguage?: string } = {},
		) {
			// First count how many insights exist so the job knows itemsTotal.
			const countRow = this.intelligence.countInsights();
			return this.jobs.start({
				kind: "regenerate",
				label: "Regenerating all insights",
				itemsTotal: countRow,
				run: async ({ update }) => {
					const total = countRow;
					const regenerated = await this.intelligence.regenerateAllInsights(
						(done, totalItems) => {
							update({
								message: `Regenerating insight ${done}/${totalItems}…`,
								fraction: totalItems > 0 ? done / totalItems : 1,
								itemsDone: done,
								itemsTotal: totalItems,
							});
						},
						body.targetLanguage,
					);
					update({
						message: `Regenerated ${regenerated} insights`,
						fraction: 1,
						itemsDone: regenerated,
						itemsTotal: total,
					});
					return { regenerated };
				},
			});
		}

		@Post("translate-titles")
		async translateTitles(
			@Body()
			body: { targetLanguage?: string } = {},
		) {
			return this.jobs.start({
				kind: "regenerate",
				label: "Translating story titles",
				run: async ({ update }) => {
					const translated = await this.intelligence.translateAllTitles(
						(done, totalItems) => {
							update({
								message: `Translating title ${done}/${totalItems}…`,
								fraction: totalItems > 0 ? done / totalItems : 1,
								itemsDone: done,
								itemsTotal: totalItems,
							});
						},
						body.targetLanguage,
					);
					update({
						message: `Translated ${translated} titles`,
						fraction: 1,
						itemsDone: translated,
					});
					return { translated };
				},
			});
		}

	@Post(":id/cancel")
	async cancel(@Param("id") id: string) {
		const ok = this.jobs.cancel(id);
		return { id, canceled: ok };
	}

	// Helper exposed for other modules that want to know if a job of a kind is
	// already running (e.g. to disable the Collect button).
	@Get("kind/:kind")
	async byKind(@Param("kind") kind: JobKind) {
		const list = this.jobs.list();
		return list.active.filter((j) => j.kind === kind);
	}
}
