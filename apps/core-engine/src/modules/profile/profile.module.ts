import { Module } from "@nestjs/common";
import { ProfileController } from "./profile.controller.js";
import { ProfileService } from "./profile.service.js";
import { HistoryModule } from "../history/history.module.js";
import { LlmModule } from "../llm/llm.module.js";
import { JobsModule } from "../jobs/jobs.module.js";

/**
 * Profile module (v1.1.0).
 *
 * Imports `HistoryModule` (for behavior-summary stats + recording generations),
 * `LlmModule` (for generate calls), and `JobsModule` (v1.8.0 — a change of the
 * AI output language kicks off the batch translate job). Registered in
 * `AppModule`.
 */
@Module({
	imports: [HistoryModule, LlmModule, JobsModule],
	controllers: [ProfileController],
	providers: [ProfileService],
	exports: [ProfileService],
})
export class ProfileModule {}
