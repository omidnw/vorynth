import {
	Body,
	Controller,
	Delete,
	Get,
	Inject,
	Param,
	Post,
} from "@nestjs/common";
import { MediaService } from "./media.service.js";
import type { SetMediaKeepAllInput, SetMediaKeepInput } from "@vorynth/types";

/**
 * Media endpoints (v1.1.0).
 *
 *   GET    /articles/:id/media            list media for an article (remote or local)
 *   POST   /articles/:id/media/keep       body { url, keep } — keep/release one item
 *   POST   /articles/:id/media/keep-all   body { keep } — bulk keep/release
 *   DELETE /articles/:id/media            release all locally-kept items for an article
 *   GET    /media/local                   storage dashboard (per-article kept media)
 *   DELETE /media/local                   purge every locally-kept blob on disk
 *
 * Media is never stored by default — bytes stay at the source URL until the
 * user opts to keep an item locally.
 */
@Controller()
export class MediaController {
	constructor(@Inject(MediaService) private readonly media: MediaService) {}

	@Get("articles/:id/media")
	async list(@Param("id") id: string) {
		return this.media.listForArticle(id);
	}

	@Post("articles/:id/media/keep")
	async keep(@Param("id") id: string, @Body() body: SetMediaKeepInput) {
		return this.media.setKeep(id, body);
	}

	@Post("articles/:id/media/keep-all")
	async keepAll(@Param("id") id: string, @Body() body: SetMediaKeepAllInput) {
		return this.media.setKeepAll(id, body);
	}

	@Delete("articles/:id/media")
	async releaseArticle(@Param("id") id: string) {
		const released = await this.media.releaseArticle(id);
		return { released };
	}

	@Get("media/local")
	async localSummary() {
		return this.media.localSummary();
	}

	@Delete("media/local")
	async purgeAll() {
		const purged = await this.media.purgeAll();
		return { purged };
	}
}
