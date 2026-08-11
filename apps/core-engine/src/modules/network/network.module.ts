import { Module } from "@nestjs/common";
import { HistoryModule } from "../history/history.module.js";
import { NetworkController } from "./network.controller.js";
import { NetworkService } from "./network.service.js";

/**
 * Network access module (v1.8.1) — exposes the engine's access mode, the
 * CORS origin allowlist, and the listening host. `NetworkService` is exported
 * because main.ts resolves it to pick the listen host + the per-request CORS
 * origin callback.
 */
@Module({
	imports: [HistoryModule],
	controllers: [NetworkController],
	providers: [NetworkService],
	exports: [NetworkService],
})
export class NetworkModule {}
