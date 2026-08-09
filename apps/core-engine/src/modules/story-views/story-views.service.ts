import { Inject, Injectable, Logger } from "@nestjs/common";
import { DatabaseService } from "../../db/database.service.js";
import type { StoryViewEntry, StoryViewScope } from "@vorynth/types";

/**
 * Story-view history (v1.8.0) — records which story the user opened, when,
 * and whether they saw the insight page, the article, or both.
 *
 * One row per "sitting": recording a view whose most recent row for the same
 * article is still inside {@link MERGE_WINDOW_MS} upgrades that row to
 * `both` when the surface differs (insight + article in one sitting) instead
 * of stacking two rows. The article title is joined at read time (R-A09 —
 * never duplicated into the view table).
 */
@Injectable()
export class StoryViewsService {
	private readonly logger = new Logger("StoryViews");

	/** Two openings of the same story inside this window count as one sitting. */
	private static readonly MERGE_WINDOW_MS = 10 * 60 * 1000;

	constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

	/** True when the article exists (so a view can be recorded against it). */
	articleExists(articleId: string): boolean {
		const row = this.db.rawDb
			.prepare("SELECT 1 AS one FROM articles WHERE id = ?")
			.get(articleId);
		return Boolean(row);
	}

	/** Record that a story was opened on the given surface. */
	record(
		articleId: string,
		scope: "insight" | "article",
	): { id: number; scope: StoryViewScope } {
		const now = Date.now();
		const last = this.db.rawDb
			.prepare(
				`SELECT id, scope, viewed_at FROM story_views
				 WHERE article_id = ? ORDER BY id DESC LIMIT 1`,
			)
			.get(articleId) as
			{ id: number; scope: StoryViewScope; viewed_at: number } | undefined;

		if (last && now - last.viewed_at <= StoryViewsService.MERGE_WINDOW_MS) {
			const merged: StoryViewScope = last.scope === scope ? last.scope : "both";
			this.db.rawDb
				.prepare("UPDATE story_views SET scope = ?, viewed_at = ? WHERE id = ?")
				.run(merged, now, last.id);
			this.logger.debug(`merged story view → ${articleId} (${merged})`);
			return { id: last.id, scope: merged };
		}

		const info = this.db.rawDb
			.prepare(
				"INSERT INTO story_views (article_id, scope, viewed_at) VALUES (?, ?, ?)",
			)
			.run(articleId, scope, now);
		this.logger.debug(`recorded story view → ${articleId} (${scope})`);
		return { id: Number(info.lastInsertRowid), scope };
	}

	/** Most recent story views, newest first, joined with the article title. */
	list(limit = 50): StoryViewEntry[] {
		const rows = this.db.rawDb
			.prepare(
				`SELECT sv.id AS id, sv.article_id AS article_id, sv.scope AS scope,
				        sv.viewed_at AS viewed_at, a.title AS article_title
				 FROM story_views sv
				 JOIN articles a ON a.id = sv.article_id
				 ORDER BY sv.id DESC
				 LIMIT ?`,
			)
			.all(limit) as Array<{
			id: number;
			article_id: string;
			scope: StoryViewScope;
			viewed_at: number;
			article_title: string;
		}>;

		return rows.map((r) => ({
			id: r.id,
			articleId: r.article_id,
			articleTitle: r.article_title,
			scope: r.scope,
			viewedAt: new Date(r.viewed_at).toISOString(),
		}));
	}
}
