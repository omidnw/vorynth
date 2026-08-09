import { Module } from "@nestjs/common";
import { ConnectorRegistryController } from "./connector-registry.controller.js";
import { ConnectorRegistryService } from "./connector-registry.service.js";

/**
 * Official connector registry (v1.8.0) — the auto-provisioning source for
 * official connectors, fetched from the Vorynth GitHub repo (the same pattern
 * as source lists). Exported so PluginsService (list/merge) and SourcesService
 * (create/verify resolution) can both consume it.
 */
@Module({
	controllers: [ConnectorRegistryController],
	providers: [ConnectorRegistryService],
	exports: [ConnectorRegistryService],
})
export class ConnectorRegistryModule {}
