import { Module } from "@nestjs/common";
import { ProfileController } from "./profile.controller.js";
import { ProfileService } from "./profile.service.js";
import { HistoryModule } from "../history/history.module.js";
import { LlmModule } from "../llm/llm.module.js";

/**
 * Profile module (v1.1.0).
 *
 * Imports `HistoryModule` (for behavior-summary stats + recording generations)
 * and `LlmModule` (for generate calls). Registered in `AppModule`.
 */
@Module({
	imports: [HistoryModule, LlmModule],
	controllers: [ProfileController],
	providers: [ProfileService],
	exports: [ProfileService],
})
export class ProfileModule {}
