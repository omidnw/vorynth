import { Module } from "@nestjs/common";
import { SourcesController } from "./sources.controller.js";
import { SourcesService } from "./sources.service.js";
import { SourceListsModule } from "./source-lists.module.js";
import { PluginsModule } from "../plugins/plugins.module.js";
import { CrawlerModule } from "../crawler/crawler.module.js";
import { ConnectorRegistryModule } from "../connector-registry/connector-registry.module.js";

@Module({
	imports: [
		PluginsModule,
		CrawlerModule,
		SourceListsModule,
		// v1.8.0 — auto-provisioning: source create/verify fetch a missing
		// official connector from the GitHub registry before rejecting.
		ConnectorRegistryModule,
	],
	controllers: [SourcesController],
	providers: [SourcesService],
	exports: [SourcesService, SourceListsModule],
})
export class SourcesModule {}
