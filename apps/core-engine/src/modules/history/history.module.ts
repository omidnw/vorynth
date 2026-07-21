import { Module } from "@nestjs/common";
import { HistoryController } from "./history.controller.js";
import { HistoryService } from "./history.service.js";

/**
 * History + app-settings module.
 *
 * `HistoryService` is exported so `SearchService` and `IntelligenceService`
 * can inject it to record entries at the moment they produce results. The
 * recording is best-effort — failures are logged, never thrown — so history
 * can't break a search or a briefing.
 */
@Module({
	controllers: [HistoryController],
	providers: [HistoryService],
	exports: [HistoryService],
})
export class HistoryModule {}
