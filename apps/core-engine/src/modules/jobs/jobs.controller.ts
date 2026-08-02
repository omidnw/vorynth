import {
	Body,
	Controller,
	Get,
	Inject,
	Param,
	Post,
	Query,
} from "@nestjs/common";
import type { BriefPeriod } from "@vorynth/types";
import { JobsService } from "./jobs.service.js";
import { registerJobRunner } from "./jobs.runners.js";
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
 *   POST   /jobs/translate-stories  translate story titles + bodies, 5 per request (background)
 *   POST   /jobs/:id/cancel   cancel a running job
 *
 * Runners live in the kind→factory registry (`jobs.runners.ts`) rather than
 * inline, so JobsService can rebuild a job from its persisted input after an
 * engine restart and resume it from its last checkpoint.
 */
@Controller("jobs")
export class JobsController {
	constructor(
		@Inject(JobsService) private readonly jobs: JobsService,
		@Inject(CrawlerService) private readonly crawler: CrawlerService,
		@Inject(IntelligenceService)
		private readonly intelligence: IntelligenceService,
		@Inject(SearchService) private readonly search: SearchService,
	) {
		this.registerRunners();
	}

	private registerRunners(): void {
		registerJobRunner("collect", (input) => {
			const force = (input as { force?: boolean } | undefined)?.force === true;
			return {
				label: force ? "Re-collecting sources" : "Collecting sources",
				run: async ({ update }) => {
					const enabled = await this.crawler.enabledCount();
					update({ itemsTotal: enabled });
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
			};
		});

		registerJobRunner("generate", (input) => {
			const { period, cap, targetLanguage } = (input ?? {}) as {
				period?: BriefPeriod;
				cap?: number;
				targetLanguage?: string;
			};
			return {
				label: "Generating intelligence",
				run: async ({ update }) => {
					update({ message: "Running LangGraph workflow…", fraction: 0.2 });
					const result = await this.intelligence.generate({
						period,
						cap,
						targetLanguage,
					});
					update({
						message: `Generated ${result.entries.length} ranked entries`,
						fraction: 1,
						itemsDone: result.entries.length,
					});
					return result;
				},
			};
		});

		registerJobRunner("summarize", (input) => {
			const { period, targetLanguage, limit } = (input ?? {}) as {
				period?: BriefPeriod;
				targetLanguage?: string;
				limit?: number;
			};
			return {
				label: "Summarizing period",
				run: async ({ update }) => {
					update({
						message: "Packing context + asking the LLM…",
						fraction: 0.3,
					});
					const result = await this.intelligence.summarizePeriod({
						period,
						targetLanguage,
						limit,
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
			};
		});

		registerJobRunner("ask", (input) => {
			const { q, periodDays, budget } = (input ?? {}) as {
				q?: string;
				periodDays?: number;
				budget?: number;
			};
			const question = q ?? "";
			return {
				label: `Asking AI: "${question.slice(0, 40)}${question.length > 40 ? "…" : ""}"`,
				run: async ({ update }) => {
					update({
						message: "Searching articles + asking the LLM…",
						fraction: 0.3,
					});
					const result = await this.search.ask(question, {
						periodMs: periodDays ? periodDays * 86_400_000 : undefined,
						contextTokenBudget: budget,
					});
					update({ message: "Done", fraction: 1 });
					return result;
				},
			};
		});

		registerJobRunner("regenerate", (input) => {
			const targetLanguage = (
				input as { targetLanguage?: string } | undefined
			)?.targetLanguage;
			const total = this.intelligence.countInsights();
			return {
				label: "Regenerating all insights",
				itemsTotal: total,
				run: async ({ update, throwIfCanceled, resumeFrom }) => {
					const regenerated =
						await this.intelligence.regenerateAllInsights(
							(done, totalItems) => {
								update({
									message: `Regenerating insight ${done}/${totalItems}…`,
									fraction: totalItems > 0 ? done / totalItems : 1,
									itemsDone: done,
									itemsTotal: totalItems,
								});
							},
							targetLanguage,
							resumeFrom,
							throwIfCanceled,
						);
					update({
						message: `Regenerated ${regenerated} insights`,
						fraction: 1,
						itemsDone: total,
						itemsTotal: total,
					});
					return { regenerated };
				},
			};
		});

		registerJobRunner("translate", (input) => {
			const targetLanguage = (
				input as { targetLanguage?: string } | undefined
			)?.targetLanguage;
			return {
				label: "Translating stories",
				run: async ({ update, throwIfCanceled }) => {
					const translated = await this.intelligence.translateAllStories(
						(done, totalItems) => {
							update({
								message: `Translating story ${done}/${totalItems}…`,
								fraction: totalItems > 0 ? done / totalItems : 1,
								itemsDone: done,
								itemsTotal: totalItems,
							});
						},
						targetLanguage,
						0, // resumeFrom — the query already excludes translated
						// stories, so a restart needs no offset (see service).
						throwIfCanceled,
					);
					update({
						message: `Translated ${translated} stories`,
						fraction: 1,
						itemsDone: translated,
					});
					return { translated };
				},
			};
		});
	}

	@Get()
	async list() {
		return this.jobs.list();
	}

	@Get(":id")
	async get(@Param("id") id: string) {
		return this.jobs.get(id) ?? { notFound: true };
	}

	@Post("collect")
	async collect(@Body() body?: { force?: boolean }) {
		return this.jobs.start({ kind: "collect", input: body });
	}

	@Post("generate")
	async generate(
		@Body()
		body: { period?: BriefPeriod; cap?: number; targetLanguage?: string } = {},
	) {
		return this.jobs.start({ kind: "generate", input: body });
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
		return this.jobs.start({ kind: "summarize", input: body });
	}

	@Post("ask")
	async ask(
		@Query("q") q: string,
		@Body() body: { periodDays?: number; budget?: number } = {},
	) {
		return this.jobs.start({
			kind: "ask",
			input: { q: q ?? "", periodDays: body.periodDays, budget: body.budget },
		});
	}

	@Post("regenerate-insights")
	async regenerateInsights(
		@Body()
		body: { targetLanguage?: string } = {},
	) {
		return this.jobs.start({ kind: "regenerate", input: body });
	}

	@Post("translate-stories")
	async translateStories(
		@Body()
		body: { targetLanguage?: string } = {},
	) {
		return this.jobs.start({ kind: "translate", input: body });
	}

	@Post(":id/cancel")
	async cancel(@Param("id") id: string) {
		const ok = this.jobs.cancel(id);
		return { id, canceled: ok };
	}

	// Helper exposed for other modules that want to know if a job of a kind is
	// already running (e.g. to disable the Collect button).
	@Get("kind/:kind")
	async byKind(@Param("kind") kind: string) {
		const list = this.jobs.list();
		return list.active.filter((j) => j.kind === kind);
	}
}
