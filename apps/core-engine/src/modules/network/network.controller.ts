import { Controller, Get, Inject } from "@nestjs/common";
import { NetworkService } from "./network.service.js";

/**
 * Network endpoints (v1.8.1 — Settings → Advanced → Developer).
 *
 *   GET /network   resolved access mode, allowlisted IPs, listening host,
 *                  port, detected LAN IPs, and the backend URL — everything
 *                  the Developer section displays. Settings themselves are
 *                  read/written via the existing GET/PATCH /settings.
 */
@Controller("network")
export class NetworkController {
	constructor(
		@Inject(NetworkService) private readonly network: NetworkService,
	) {}

	@Get()
	info() {
		return this.network.info();
	}
}
