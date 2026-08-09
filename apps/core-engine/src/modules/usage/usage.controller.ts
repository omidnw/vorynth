import { Controller, Delete, Get, Inject } from "@nestjs/common";
import { UsageService } from "./usage.service.js";

/**
 * Storage + resource usage endpoints (v1.8.0) — the Settings "Storage & Usage"
 * surface.
 *
 *   GET    /usage         storage snapshot: data-dir libraries (database, media,
 *                         backups, plugins), story counts, engine RAM/CPU.
 *   DELETE /stories       "clear all stories" — deletes every article except
 *                         bookmarked ones and ones inside a collection (R-A10).
 *
 * Media clearing lives on the media module (`DELETE /media/local`); the usage
 * section reuses it.
 */
@Controller()
export class UsageController {
	constructor(@Inject(UsageService) private readonly usage: UsageService) {}

	@Get("usage")
	async snapshot() {
		return this.usage.usage();
	}

	@Delete("stories")
	async clearStories() {
		return this.usage.clearStories();
	}
}
