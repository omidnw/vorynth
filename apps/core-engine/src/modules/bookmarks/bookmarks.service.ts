import {
	BadRequestException,
	ConflictException,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { DatabaseService } from "../../db/database.service.js";
import { ArchiveService } from "../archive/archive.service.js";
import type { ArchiveItem, BookmarkList } from "@vorynth/types";

/**
 * Bookmarks service (v1.6.0).
 *
 * A bookmark is a FLAG on a content item — user ownership of a reference
 * (R-A10), not a content type. The bookmark table only references
 * `content_items.content_item_id` (UNIQUE), so it is generic: articles today,
 * AI answers/summaries later, with no migration. Deleting a bookmark removes
 * only the flag — the item and its origin stay.
 */
@Injectable()
export class BookmarksService {
	constructor(
		@Inject(DatabaseService) private readonly db: DatabaseService,
		@Inject(ArchiveService) private readonly archive: ArchiveService,
	) {}

	/** Bookmark a content item. Returns the item with `bookmarked: true`. */
	async create(contentItemId: string): Promise<ArchiveItem> {
		if (!contentItemId || typeof contentItemId !== "string") {
			throw new BadRequestException({
				code: "INVALID_BOOKMARK_TARGET",
				message: "contentItemId is required",
			});
		}
		const exists = this.db.rawDb
			.prepare("SELECT id FROM content_items WHERE id = ?")
			.get(contentItemId);
		if (!exists) {
			throw new NotFoundException({
				code: "CONTENT_ITEM_NOT_FOUND",
				message: `content item ${contentItemId} not found`,
			});
		}
		const claimed = this.db.rawDb
			.prepare("SELECT id FROM bookmarks WHERE content_item_id = ?")
			.get(contentItemId);
		if (claimed) {
			throw new ConflictException({
				code: "BOOKMARK_ALREADY_EXISTS",
				message: `content item ${contentItemId} is already bookmarked`,
			});
		}
		this.db.rawDb
			.prepare(
				"INSERT INTO bookmarks (id, content_item_id, created_at) VALUES (?, ?, ?)",
			)
			.run(randomUUID(), contentItemId, Date.now());
		return this.archive.getItem(contentItemId);
	}

	/** Remove the bookmark flag. The item and its origin stay (R-A10). */
	async remove(contentItemId: string): Promise<{ removed: boolean }> {
		const res = this.db.rawDb
			.prepare("DELETE FROM bookmarks WHERE content_item_id = ?")
			.run(contentItemId);
		return { removed: res.changes > 0 };
	}

	/** List bookmarked items (same shape as archive items). */
	async list(opts?: {
		limit?: number;
		offset?: number;
	}): Promise<BookmarkList> {
		return this.archive.listItems({ bookmarked: true, ...opts });
	}
}
