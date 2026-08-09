import { Module } from "@nestjs/common";
import { SourceListsController } from "./source-lists.controller.js";
import { SourceListsService } from "./source-lists.service.js";
import { PluginsModule } from "../plugins/plugins.module.js";

/**
 * Source lists live in the sources folder but are their own module so the
 * crawler can depend on them WITHOUT a circular SourcesModule ↔ CrawlerModule
 * import (CrawlerService gates collection on the lists' enabled state).
 */
@Module({
	imports: [PluginsModule],
	controllers: [SourceListsController],
	providers: [SourceListsService],
	exports: [SourceListsService],
})
export class SourceListsModule {}
