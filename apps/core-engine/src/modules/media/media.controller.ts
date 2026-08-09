import {
	Body,
	Controller,
	Delete,
	Get,
	Inject,
	NotFoundException,
	Param,
	Post,
	Res,
} from "@nestjs/common";
import type { FastifyReply } from "fastify";
import { createReadStream } from "node:fs";
import { basename } from "node:path";
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
 *   GET    /media/local/:itemId/file      the kept item's bytes (download endpoint)
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

	/**
	 * Stream a locally-kept media item's bytes as an attachment. The desktop
	 * fetches this as a Blob and either downloads it as-is or draws the
	 * copyright attribution into it (images) before saving.
	 */
	@Get("media/local/:itemId/file")
	async localFile(@Param("itemId") itemId: string, @Res() reply: FastifyReply) {
		const file = await this.media.getLocalFile(itemId);
		if (!file) {
			throw new NotFoundException(`Local media item ${itemId} not found`);
		}
		reply
			.header("Content-Type", file.mime ?? "application/octet-stream")
			.header(
				"Content-Disposition",
				`attachment; filename="${basename(file.path)}"`,
			)
			.header("Content-Length", String(file.bytes ?? 0));
		return reply.send(createReadStream(file.path));
	}

	@Delete("media/local")
	async purgeAll() {
		const purged = await this.media.purgeAll();
		return { purged };
	}
}
