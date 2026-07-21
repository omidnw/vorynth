import { Module } from "@nestjs/common";
import { CrawlerModule } from "../crawler/crawler.module.js";
import { IntelligenceModule } from "../intelligence/intelligence.module.js";
import { LlmModule } from "../llm/llm.module.js";
import { SchedulerService } from "./scheduler.service.js";
import { SchedulerBootstrap } from "./scheduler.bootstrap.js";

/**
 * Scheduler module — wires background jobs (project-details.md §31).
 *
 * The actual job registration lives in `SchedulerBootstrap` (a dedicated
 * OnModuleInit provider) so the SchedulerService stays a pure scheduler and
 * we don't get duplicate "started" logs from two lifecycle hooks.
 */
@Module({
	imports: [CrawlerModule, LlmModule, IntelligenceModule],
	providers: [SchedulerService, SchedulerBootstrap],
	exports: [SchedulerService],
})
export class SchedulerModule {}
