import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SchedulerService } from "./scheduler.service.js";
import { CrawlerService } from "../crawler/crawler.service.js";
import { IntelligenceService } from "../intelligence/intelligence.service.js";
import { LlmService } from "../llm/llm.service.js";
import { RetentionService } from "../retention/retention.service.js";
import { TrashService } from "../trash/trash.service.js";
import { SourceListsService } from "../sources/source-lists.service.js";
import { ConnectorRegistryService } from "../connector-registry/connector-registry.service.js";
import { HistoryService } from "../history/history.service.js";
import { JobsService } from "../jobs/jobs.service.js";

/**
 * Registers the background jobs (project-details.md §31).
 *
 *   every 30 minutes  collect from all enabled sources (default; overridable
 *                       via VORYNTH_COLLECT_INTERVAL_MS)
 *   daily at 06:00 UTC  generate the daily intelligence report (only when an
 *                       LLM is configured; otherwise a no-op)
 *   daily at 06:00 UTC  auto-delete retention sweep (v1.6.0; no-op when off)
 *   daily at 06:00 UTC  trash purge sweep (v1.7.0; no-op when retention is 0)
 *   daily at 06:00 UTC  community catalog refresh (v1.8.0; a failed refresh is
 *                       logged and the cached catalog stays intact)
 *   daily at 07:00 UTC  data health check (v1.8.0; gated on the
 *                       dataHealth.autoCheck setting, default on — visible in
 *                       the Jobs tray since it runs through the jobs system)
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
		@Inject(SourceListsService)
		private readonly sourceLists: SourceListsService,
		@Inject(ConnectorRegistryService)
		private readonly connectors: ConnectorRegistryService,
		@Inject(HistoryService) private readonly history: HistoryService,
		@Inject(JobsService) private readonly jobs: JobsService,
		@Inject(ConfigService) private readonly config: ConfigService,
	) {}

	onModuleInit() {
		const collectInterval = Number(
			this.config.get<string>("VORYNTH_COLLECT_INTERVAL_MS") ?? 30 * 60_000,
		);
		const reportHour = Number(
			this.config.get<string>("VORYNTH_REPORT_HOUR_UTC") ?? 6,
		);
		const healthHour = Number(
			this.config.get<string>("VORYNTH_HEALTH_HOUR_UTC") ?? 7,
		);

		this.scheduler.every(collectInterval, "collect-all", async () => {
			const results = await this.crawler.collectAll();
			// Auto-translate (v1.9.0): a collect that pulled in new stories
			// chains a translation job — but only when an LLM is configured.
			// News mode has no key, so nothing is queued (R-A03). The translate
			// job itself skips stories whose source language matches the target
			// and rides each story's AI insight along.
			const collected = results.reduce((s, r) => s + r.collected, 0);
			if (collected > 0 && (await this.intelligence.canTranslate())) {
				this.jobs.start({ kind: "translate" });
			}
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

		// v1.8.0 — community catalog sync. Failures are logged by the service
		// (or throw for a reachability outage); the cached catalog is never
		// cleared, so this job is safe to run daily.
		this.scheduler.dailyAt(
			reportHour,
			"refresh-community-sources",
			async () => {
				await this.sourceLists.refreshCatalog();
			},
		);

		// v1.8.0 — official connector registry sync (arXiv & future official
		// connectors). The cached rows are the offline catalog; a failed fetch
		// never clears them, so a daily run keeps definitions current.
		this.scheduler.dailyAt(
			reportHour,
			"refresh-connector-registry",
			async () => {
				await this.connectors.refresh();
			},
		);

		// v1.8.0 — data health check: self-heal stored articles (full text for
		// snippet-only stories, stale-translation repair, missing-insight
		// backfill). Gated on the dataHealth.autoCheck setting (default on);
		// started through the jobs system so it shows in the Jobs tray — the
		// user is never left wondering what the engine did.
		this.scheduler.dailyAt(healthHour, "data-health-check", async () => {
			const enabled = await this.history.getSetting(
				"dataHealth.autoCheck",
				true,
			);
			if (!enabled) return;
			await this.jobs.start({ kind: "health-check", input: {} });
		});
	}
}
