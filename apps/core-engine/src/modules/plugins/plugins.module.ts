import { Module } from "@nestjs/common";
import { PluginsService } from "./plugins.service.js";
import { PluginsController } from "./plugins.controller.js";
import { ConnectorRegistryModule } from "../connector-registry/connector-registry.module.js";

/**
 * Plugins module (v1.8.0) — the adapter plugin registry.
 *
 * Exported so `CrawlerService` (enabled checks) and `SourcesService`
 * (type→adapter resolution, source verification) can consume it. Imports the
 * connector registry so official connectors (fetched from GitHub) merge into
 * the plugin list and resolve like built-ins.
 */
@Module({
	imports: [ConnectorRegistryModule],
	controllers: [PluginsController],
	providers: [PluginsService],
	exports: [PluginsService],
})
export class PluginsModule {}
