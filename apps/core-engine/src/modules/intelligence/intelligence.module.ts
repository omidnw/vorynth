import { Module } from "@nestjs/common";
import { LlmModule } from "../llm/llm.module.js";
import { NewsModule } from "../news/news.module.js";
import { HistoryModule } from "../history/history.module.js";
import { IntelligenceController } from "./intelligence.controller.js";
import { IntelligenceService } from "./intelligence.service.js";

@Module({
	imports: [LlmModule, NewsModule, HistoryModule],
	controllers: [IntelligenceController],
	providers: [IntelligenceService],
	exports: [IntelligenceService],
})
export class IntelligenceModule {}
