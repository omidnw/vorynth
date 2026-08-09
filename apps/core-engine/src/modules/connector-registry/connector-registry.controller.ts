import { Controller, Get, Inject, Post } from "@nestjs/common";
import { ConnectorRegistryService } from "./connector-registry.service.js";
import type { RefreshConnectorsResult } from "@vorynth/types";
import type { AdapterManifest } from "../plugins/plugins.manifests.js";

/**
 * Official connector registry endpoints (v1.8.0).
 *
 *   GET  /connectors        currently registered official connectors
 *   POST /connectors/refresh  fetch the GitHub registry (cache-updating)
 */
@Controller("connectors")
export class ConnectorRegistryController {
	constructor(
		@Inject(ConnectorRegistryService)
		private readonly registry: ConnectorRegistryService,
	) {}

	@Get()
	registered(): AdapterManifest[] {
		return this.registry
			.registeredRows()
			.map((row) => this.registry.registeredManifest(row.id))
			.filter((m): m is AdapterManifest => m !== null);
	}

	@Post("refresh")
	refresh(): Promise<RefreshConnectorsResult> {
		return this.registry.refresh();
	}
}
