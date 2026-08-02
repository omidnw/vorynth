import {
	Body,
	Controller,
	Delete,
	Get,
	Inject,
	Param,
	Patch,
	Post,
	Query,
} from "@nestjs/common";
import { ArchiveService } from "./archive.service.js";
import type {
	CreateCollectionInput,
	UpdateArchiveItemInput,
	UpdateCollectionInput,
} from "@vorynth/types";

/**
 * Archive endpoints (v1.6.0).
 *
 *   GET    /archive/items                list (filters + curated default)
 *   GET    /archive/items/:id            full item incl. origin
 *   PATCH  /archive/items/:id            note / tags / collection / archived
 *   GET    /archive/collections          list (tree)
 *   POST   /archive/collections          create (parent_type + depth checks)
 *   PATCH  /archive/collections/:id      rename / move / re-kind
 *   DELETE /archive/collections/:id      items → uncategorized, children re-parent
 */
@Controller("archive")
export class ArchiveController {
	constructor(
		@Inject(ArchiveService) private readonly archive: ArchiveService,
	) {}

	@Get("items")
	async listItems(
		@Query("contentType") contentType?: string,
		@Query("collectionId") collectionId?: string,
		@Query("direct") direct?: string,
		@Query("tag") tag?: string,
		@Query("q") q?: string,
		@Query("archived") archived?: string,
		@Query("bookmarked") bookmarked?: string,
		@Query("limit") limit?: string,
		@Query("offset") offset?: string,
	) {
		return this.archive.listItems({
			contentType: contentType || undefined,
			collectionId: collectionId || undefined,
			direct: direct === "true" ? true : undefined,
			tag: tag || undefined,
			q: q || undefined,
			archived:
				archived === "true" ? true : archived === "false" ? false : undefined,
			bookmarked:
				bookmarked === "true" ? true : bookmarked === "false" ? false : undefined,
			limit: limit ? Number(limit) : undefined,
			offset: offset ? Number(offset) : undefined,
		});
	}

	@Get("items/:id")
	async getItem(@Param("id") id: string) {
		return this.archive.getItem(id);
	}

	@Patch("items/:id")
	async patchItem(
		@Param("id") id: string,
		@Body() body: UpdateArchiveItemInput,
	) {
		return this.archive.updateItem(id, body ?? {});
	}

	@Get("collections")
	async listCollections() {
		return this.archive.listCollections();
	}

	@Post("collections")
	async createCollection(@Body() body: CreateCollectionInput) {
		return this.archive.createCollection(body ?? {});
	}

	@Patch("collections/:id")
	async patchCollection(
		@Param("id") id: string,
		@Body() body: UpdateCollectionInput,
	) {
		return this.archive.updateCollection(id, body ?? {});
	}

	@Delete("collections/:id")
	async removeCollection(@Param("id") id: string) {
		await this.archive.deleteCollection(id);
		return { id, removed: true };
	}
}
