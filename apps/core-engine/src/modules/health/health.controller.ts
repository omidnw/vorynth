import { Controller, Get } from "@nestjs/common";

/**
 * `GET /health` — readiness probe.
 *
 * Polled by the Tauri shell on launch (and optionally by the frontend's API
 * client) to confirm the sidecar is up before routing traffic to it.
 */
@Controller("health")
export class HealthController {
	@Get()
	health(): { status: "ok"; service: string; timestamp: string } {
		return {
			status: "ok",
			service: "vorynth-core-engine",
			timestamp: new Date().toISOString(),
		};
	}
}
