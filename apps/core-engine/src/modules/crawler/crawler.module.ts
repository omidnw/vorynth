import { Module } from "@nestjs/common";
import { CrawlerService } from "./crawler.service.js";
import { CrawlerController } from "./crawler.controller.js";
import { PluginsModule } from "../plugins/plugins.module.js";
import { SourceListsModule } from "../sources/source-lists.module.js";

@Module({
	imports: [PluginsModule, SourceListsModule],
	controllers: [CrawlerController],
	providers: [CrawlerService],
	exports: [CrawlerService],
})
export class CrawlerModule {}
