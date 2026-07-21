import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller.js";

/**
 * Health module.
 *
 * `GET /health` is polled by the Tauri shell on app launch to wait until the
 * bundled sidecar is ready before handing its port to the webview.
 */
@Module({
	controllers: [HealthController],
})
export class HealthModule {}
