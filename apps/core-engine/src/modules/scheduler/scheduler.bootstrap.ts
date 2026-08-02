import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SchedulerService } from "./scheduler.service.js";
import { CrawlerService } from "../crawler/crawler.service.js";
import { IntelligenceService } from "../intelligence/intelligence.service.js";
import { LlmService } from "../llm/llm.service.js";
import { RetentionService } from "../retention/retention.service.js";
import { TrashService } from "../trash/trash.service.js";

/**
 * Registers the background jobs (project-details.md §31).
 *
 *   every 30 minutes  collect from all enabled sources (default; overridable
 *                       via VORYNTH_COLLECT_INTERVAL_MS)
 *   daily at 06:00 UTC  generate the daily intelligence report (only when an
 *                       LLM is configured; otherwise a no-op)
 *   daily at 06:00 UTC  auto-delete retention sweep (v1.6.0; no-op when off)
 *   daily at 06:00 UTC  trash purge sweep (v1.7.0; no-op when retention is 0)
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
		@Inject(RetentionService) private readonly retention: RetentionService,
		@Inject(TrashService) private readonly trash: TrashService,
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

		// v1.6.0 — auto-delete retention, once a day alongside the report.
		this.scheduler.dailyAt(reportHour, "retention-sweep", async () => {
			this.retention.run();
		});

		// v1.7.0 — trash auto-purge (expired soft-deletes), once a day.
		this.scheduler.dailyAt(reportHour, "trash-purge", async () => {
			this.trash.run();
		});
	}
}
