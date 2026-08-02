import { Inject, Injectable, Logger } from "@nestjs/common";
import { lt } from "drizzle-orm";
import { DatabaseService } from "../../db/database.service.js";
import { articles } from "../../db/schema.js";
import { HistoryService } from "../history/history.service.js";

/**
 * Auto-delete retention (v1.6.0) — a global "delete old stories" policy
 * independent of each source's fetch window.
 *
 * Controlled by app settings:
 *   `retention.autoDeleteDays`      — days of age (by collected time) after
 *                                     which a story is removed. 0 = off.
 *   `retention.protectBookmarked`   — never delete bookmarked stories (R-A10).
 *   `retention.protectInCollection` — never delete stories placed in a
 *                                     collection (user organization).
 *
 * Runs from the scheduler (daily) and at startup; deletes in one transaction
 * and cleans up orphaned archive spines + bookmark flags, exactly like source
 * deletion does — no orphans remain.
 */
@Injectable()
export class RetentionService {
	private readonly logger = new Logger("Retention");

	constructor(
		@Inject(DatabaseService) private readonly db: DatabaseService,
		@Inject(HistoryService) private readonly history: HistoryService,
	) {}

	/** Run the retention sweep. Returns the number of stories removed. */
	run(): number {
		const days = this.history.getSetting<number>("retention.autoDeleteDays", 0);
		if (!days || days <= 0) return 0;

		const protectBookmarked = this.history.getSetting<boolean>(
			"retention.protectBookmarked",
			true,
		);
		const protectInCollection = this.history.getSetting<boolean>(
			"retention.protectInCollection",
			true,
		);

		const cutoff = new Date(Date.now() - days * 86_400_000);
		const raw = this.db.rawDb;

		const clauses = [`collected_at < ?`];
		const params: unknown[] = [cutoff.getTime()];
		if (protectBookmarked) {
			clauses.push(
				`content_item_id NOT IN (SELECT content_item_id FROM bookmarks WHERE content_item_id IS NOT NULL)`,
			);
		}
		if (protectInCollection) {
			clauses.push(
				`content_item_id NOT IN (SELECT id FROM content_items WHERE collection_id IS NOT NULL)`,
			);
		}

		const removed = raw
			.prepare(`DELETE FROM articles WHERE ${clauses.join(" AND ")}`)
			.run(...params).changes;

		if (removed > 0) {
			// Stories deleted → their spines are now orphans; bookmarks on them
			// cascade. Remove the orphan spines so integrity holds (R-A09).
			raw.prepare(
				`DELETE FROM content_items
				 WHERE id NOT IN (SELECT content_item_id FROM articles WHERE content_item_id IS NOT NULL)
				   AND id NOT IN (SELECT content_item_id FROM search_history WHERE content_item_id IS NOT NULL)
				   AND id NOT IN (SELECT content_item_id FROM brief_history WHERE content_item_id IS NOT NULL)
				   AND id NOT IN (SELECT content_item_id FROM generated_history WHERE content_item_id IS NOT NULL)`,
			).run();
			this.logger.log(
				`auto-delete removed ${removed} stories older than ${days} days (protect bookmarked: ${protectBookmarked}, protect in collection: ${protectInCollection})`,
			);
		}
		return removed;
	}
}
