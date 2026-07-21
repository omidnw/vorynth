import { Module } from "@nestjs/common";
import { CrawlerService } from "./crawler.service.js";
import { CrawlerController } from "./crawler.controller.js";

@Module({
	controllers: [CrawlerController],
	providers: [CrawlerService],
	exports: [CrawlerService],
})
export class CrawlerModule {}
