import {
	Body,
	Controller,
	Delete,
	Get,
	Inject,
	Param,
	Post,
	Query,
} from "@nestjs/common";
import { BookmarksService } from "./bookmarks.service.js";

/**
 * Bookmarks endpoints (v1.6.0).
 *
 *   POST   /bookmarks { contentItemId }   save an item (flag, generic)
 *   DELETE /bookmarks/:contentItemId      unsave — flag only, item stays
 *   GET    /bookmarks?limit=&offset=      list saved items (archive shape)
 */
@Controller("bookmarks")
export class BookmarksController {
	constructor(
		@Inject(BookmarksService) private readonly bookmarks: BookmarksService,
	) {}

	@Post()
	async create(@Body() body: { contentItemId?: string }) {
		return this.bookmarks.create(body?.contentItemId ?? "");
	}

	@Delete(":contentItemId")
	async remove(@Param("contentItemId") contentItemId: string) {
		return this.bookmarks.remove(contentItemId);
	}

	@Get()
	async list(
		@Query("limit") limit?: string,
		@Query("offset") offset?: string,
	) {
		return this.bookmarks.list({
			limit: limit ? Number(limit) : undefined,
			offset: offset ? Number(offset) : undefined,
		});
	}
}
