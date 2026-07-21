import { Module } from "@nestjs/common";
import { CrawlerModule } from "../crawler/crawler.module.js";
import { IntelligenceModule } from "../intelligence/intelligence.module.js";
import { SearchModule } from "../search/search.module.js";
import { JobsController } from "./jobs.controller.js";
import { JobsService } from "./jobs.service.js";

@Module({
	imports: [CrawlerModule, IntelligenceModule, SearchModule],
	controllers: [JobsController],
	providers: [JobsService],
	exports: [JobsService],
})
export class JobsModule {}
