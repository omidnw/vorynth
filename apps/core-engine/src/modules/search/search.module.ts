import { Module } from "@nestjs/common";
import { SearchController } from "./search.controller.js";
import { SearchService } from "./search.service.js";
import { LlmModule } from "../llm/llm.module.js";
import { HistoryModule } from "../history/history.module.js";

@Module({
	imports: [LlmModule, HistoryModule],
	controllers: [SearchController],
	providers: [SearchService],
	exports: [SearchService],
})
export class SearchModule {}
