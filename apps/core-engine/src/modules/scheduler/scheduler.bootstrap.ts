import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SchedulerService } from "./scheduler.service.js";
import { CrawlerService } from "../crawler/crawler.service.js";
import { IntelligenceService } from "../intelligence/intelligence.service.js";
import { LlmService } from "../llm/llm.service.js";

/**
 * Registers the background jobs (project-details.md §31).
 *
 *   every 30 minutes  collect from all enabled sources (default; overridable
 *                       via VORYNTH_COLLECT_INTERVAL_MS)
 *   daily at 06:00 UTC  generate the daily intelligence report (only when an
 *                       LLM is configured; otherwise a no-op)
 *
 * Lives in its own provider so the SchedulerService itself only owns the
 * clock — no double lifecycle hooks, no duplicate "scheduler started" logs.
 */
@Injectable()
export class SchedulerBootstrap implements OnModuleInit {
	constructor(
		@Inject(SchedulerService) private readonly scheduler: SchedulerService,
		@Inject(CrawlerService) private readonly crawler: CrawlerService,
		@Inject(LlmService) private readonly llm: LlmService,
		@Inject(IntelligenceService)
		private readonly intelligence: IntelligenceService,
		@Inject(ConfigService) private readonly config: ConfigService,
	) {}

	onModuleInit() {
		const collectInterval = Number(
			this.config.get<string>("VORYNTH_COLLECT_INTERVAL_MS") ?? 30 * 60_000,
		);
		const reportHour = Number(
			this.config.get<string>("VORYNTH_REPORT_HOUR_UTC") ?? 6,
		);

		this.scheduler.every(collectInterval, "collect-all", async () => {
			await this.crawler.collectAll();
		});

		this.scheduler.dailyAt(reportHour, "daily-report", async () => {
			const available = await this.llm.isAvailable();
			if (!available) return; // news mode — nothing to do
			await this.intelligence.generate({ cap: 20 });
		});
	}
}
