import {
	ConflictException,
	Inject,
	Injectable,
	Logger,
} from "@nestjs/common";
import { DatabaseService } from "../../db/database.service.js";
import { ArchiveService } from "../archive/archive.service.js";
import { HistoryService } from "../history/history.service.js";
import type {
	PurgeTrashInput,
	RestoreTrashInput,
	TrashEntry,
	TrashKind,
	TrashList,
} from "@vorynth/types";

/** History families that can be soft-deleted (each with its own table). */
const HISTORY_KINDS = ["search", "brief", "generated"] as const;
type HistoryKind = (typeof HISTORY_KINDS)[number];

const HISTORY_TABLE: Record<HistoryKind, string> = {
	search: "search_history",
	brief: "brief_history",
	generated: "generated_history",
};

/**
 * Trash (v1.7.0) — the unified soft-delete space.
 *
 * Deleting a collection or a history entry soft-deletes it (`deleted_at` set):
 * it disappears from the live view but stays fully restorable. The daily
 * `run()` sweep permanently purges entries older than
 * `trash.retentionValue` × `trash.retentionUnit` (default 7 days; 0 = keep
 * until the user empties the trash). Bookmarked history spines are never
 * auto-purged (R-A10) and refuse permanent deletion without `force` — the UI
 * confirms explicitly first, mirroring the source-delete pattern.
 *
 * Collection restore semantics (R-A11 / user spec): items that still point
 * into the restored subtree come back with it; items the user moved elsewhere
 * keep their new home.
 */
@Injectable()
export class TrashService {
	private readonly logger = new Logger("Trash");

	constructor(
		@Inject(DatabaseService) private readonly db: DatabaseService,
		@Inject(ArchiveService) private readonly archive: ArchiveService,
		@Inject(HistoryService) private readonly history: HistoryService,
	) {}

	/** Unified trash list — trashed collection subtree roots + trashed history. */
	list(): TrashList {
		const raw = this.db.rawDb;
		const items: TrashEntry[] = [];

		// ── Collections ─────────────────────────────────────────────────────
		// Only subtree roots are listed: a collection whose parent is also
		// trashed restores/purges with its root, so it isn't its own entry.
		const cols = raw
			.prepare(
				`SELECT id, name, kind, parent_id AS parentId, deleted_at AS deletedAt
				 FROM collections WHERE deleted_at IS NOT NULL`,
			)
			.all() as Array<{
			id: string;
			name: string;
			kind: string;
			parentId: string | null;
			deletedAt: number;
		}>;
		const trashedIds = new Set(cols.map((c) => c.id));
		const roots = cols.filter((c) => !c.parentId || !trashedIds.has(c.parentId));
		const childrenByParent = new Map<
			string,
			Array<{ id: string; kind: string }>
		>();
		for (const c of cols) {
			if (!c.parentId) continue;
			const list = childrenByParent.get(c.parentId) ?? [];
			list.push({ id: c.id, kind: c.kind });
			childrenByParent.set(c.parentId, list);
		}
		const itemCounts = raw
			.prepare(
				`SELECT collection_id AS cid, COUNT(*) AS c FROM content_items
				 WHERE collection_id IS NOT NULL GROUP BY collection_id`,
			)
			.all() as Array<{ cid: string; c: number }>;
		const bookmarkCounts = raw
			.prepare(
				`SELECT ci.collection_id AS cid, COUNT(*) AS c
				 FROM content_items ci JOIN bookmarks b ON b.content_item_id = ci.id
				 WHERE ci.collection_id IS NOT NULL GROUP BY ci.collection_id`,
			)
			.all() as Array<{ cid: string; c: number }>;
		const itemsByCol = new Map(itemCounts.map((r) => [r.cid, r.c]));
		const bookmarksByCol = new Map(bookmarkCounts.map((r) => [r.cid, r.c]));

		for (const root of roots) {
			const seen = new Set<string>([root.id]);
			const stack = [...(childrenByParent.get(root.id) ?? [])];
			let subFolders = 0;
			let itemCount = itemsByCol.get(root.id) ?? 0;
			let bookmarkCount = bookmarksByCol.get(root.id) ?? 0;
			while (stack.length > 0) {
				const n = stack.pop()!;
				if (seen.has(n.id)) continue;
				seen.add(n.id);
				if (n.kind === "folder") subFolders += 1;
				itemCount += itemsByCol.get(n.id) ?? 0;
				bookmarkCount += bookmarksByCol.get(n.id) ?? 0;
				for (const ch of childrenByParent.get(n.id) ?? []) stack.push(ch);
			}
			const kindLabel = root.kind === "category" ? "Category" : "Folder";
			const parts = [
				kindLabel,
				`${subFolders} sub-folder${subFolders === 1 ? "" : "s"}`,
				`${itemCount} item${itemCount === 1 ? "" : "s"}`,
			];
			items.push({
				id: root.id,
				kind: "collection",
				name: root.name,
				deletedAt: new Date(root.deletedAt).toISOString(),
				subtitle: parts.join(" · "),
				bookmarkedCount: bookmarkCount,
			});
		}

		// ── History ─────────────────────────────────────────────────────────
		for (const kind of HISTORY_KINDS) {
			const rows = raw
				.prepare(
					`SELECT h.id, h.title, h.deleted_at AS deletedAt,
					        EXISTS (SELECT 1 FROM bookmarks b
					                WHERE b.content_item_id = h.content_item_id) AS bookmarked
					 FROM ${HISTORY_TABLE[kind]} h WHERE h.deleted_at IS NOT NULL`,
				)
				.all() as Array<{
				id: string;
				title: string;
				deletedAt: number;
				bookmarked: number;
			}>;
			for (const r of rows) {
				items.push({
					id: r.id,
					kind,
					name: r.title,
					deletedAt: new Date(r.deletedAt).toISOString(),
					bookmarkedCount: r.bookmarked ? 1 : 0,
				});
			}
		}

		items.sort((a, b) => (a.deletedAt < b.deletedAt ? 1 : -1));
		return { items };
	}

	/** Restore one entry — back to the live view, exactly as it was. */
	async restore(input: RestoreTrashInput): Promise<void> {
		switch (input.kind) {
			case "collection":
				await this.archive.restoreCollection(input.id);
				return;
			case "search":
				this.history.restoreSearch(input.id);
				return;
			case "brief":
				this.history.restoreBrief(input.id);
				return;
			case "generated":
				this.history.restoreGenerated(input.id);
				return;
		}
	}

	/** Permanently delete one entry. Bookmarked history needs `force` (R-A10). */
	async purge(input: PurgeTrashInput): Promise<number> {
		if (input.kind === "collection") {
			return this.archive.purgeCollection(input.id);
		}
		const bookmarked = this.countBookmarkedHistory(input.kind, [input.id]);
		if (bookmarked > 0 && !input.force) {
			throw new ConflictException({
				code: "BOOKMARKED_ITEMS_EXIST",
				message: `${bookmarked} saved item(s) inside would be permanently deleted. Confirm to remove them too.`,
				count: bookmarked,
			});
		}
		return this.purgeHistory(input.kind, [input.id]);
	}

	/** Permanently delete everything in the trash. */
	empty(force: boolean): number {
		// Pre-flight: refuse before touching anything if saved items are at risk.
		let bookmarkedTotal = 0;
		for (const kind of HISTORY_KINDS) {
			const ids = this.trashedHistoryIds(kind);
			if (ids.length > 0) {
				bookmarkedTotal += this.countBookmarkedHistory(kind, ids);
			}
		}
		if (bookmarkedTotal > 0 && !force) {
			throw new ConflictException({
				code: "BOOKMARKED_ITEMS_EXIST",
				message: `${bookmarkedTotal} saved item(s) in the trash would be permanently deleted. Confirm to remove them too.`,
				count: bookmarkedTotal,
			});
		}

		let removed = 0;
		// Collections — content untouched; FK moves items to uncategorized.
		const colRes = this.db.rawDb
			.prepare("DELETE FROM collections WHERE deleted_at IS NOT NULL")
			.run();
		removed += colRes.changes;
		for (const kind of HISTORY_KINDS) {
			const ids = this.trashedHistoryIds(kind);
			if (ids.length > 0) removed += this.purgeHistory(kind, ids);
		}
		return removed;
	}

	/**
	 * Daily sweep — permanently purge trash older than the retention window.
	 * Runs from the scheduler (mirror of the retention sweep). Never auto-purges
	 * bookmarked history spines (R-A10).
	 */
	run(): void {
		try {
			const value = this.history.getSetting<number>("trash.retentionValue", 7);
			if (!value || value <= 0) return; // 0 = keep until manually emptied
			const unit = this.history.getSetting<string>(
				"trash.retentionUnit",
				"days",
			);
			const unitMs =
				{
					days: 86_400_000,
					weeks: 7 * 86_400_000,
					months: 30 * 86_400_000,
					years: 365 * 86_400_000,
				}[unit as "days" | "weeks" | "months" | "years"] ?? 86_400_000;
			const cutoff = Date.now() - value * unitMs;
			const raw = this.db.rawDb;

			// A soft-deleted subtree shares its root's deleted_at timestamp, so
			// this single delete removes expired roots and descendants together.
			const colRes = raw
				.prepare(
					"DELETE FROM collections WHERE deleted_at IS NOT NULL AND deleted_at < ?",
				)
				.run(cutoff);
			if (colRes.changes > 0) {
				this.logger.log(`Trash sweep: purged ${colRes.changes} collection(s)`);
			}

			for (const kind of HISTORY_KINDS) {
				const rows = raw
					.prepare(
						`SELECT h.id FROM ${HISTORY_TABLE[kind]} h
						 WHERE h.deleted_at IS NOT NULL AND h.deleted_at < ?
						   AND h.content_item_id NOT IN
						     (SELECT content_item_id FROM bookmarks WHERE content_item_id IS NOT NULL)`,
					)
					.all(cutoff) as Array<{ id: string }>;
				const ids = rows.map((r) => r.id);
				if (ids.length === 0) continue;
				const n = this.purgeHistory(kind, ids);
				this.logger.log(
					`Trash sweep: purged ${n} ${kind} history entr${n === 1 ? "y" : "ies"}`,
				);
			}
		} catch (err) {
			this.logger.warn(`Trash sweep failed: ${(err as Error).message}`);
		}
	}

	// ── internals ────────────────────────────────────────────────────────────

	private trashedHistoryIds(kind: HistoryKind): string[] {
		const rows = this.db.rawDb
			.prepare(
				`SELECT id FROM ${HISTORY_TABLE[kind]} WHERE deleted_at IS NOT NULL`,
			)
			.all() as Array<{ id: string }>;
		return rows.map((r) => r.id);
	}

	private countBookmarkedHistory(
		kind: TrashKind,
		ids: string[],
	): number {
		if (kind === "collection" || ids.length === 0) return 0;
		const placeholders = ids.map(() => "?").join(", ");
		const row = this.db.rawDb
			.prepare(
				`SELECT COUNT(*) AS c FROM ${HISTORY_TABLE[kind as HistoryKind]} h
				 WHERE h.id IN (${placeholders})
				   AND h.content_item_id IN
				     (SELECT content_item_id FROM bookmarks WHERE content_item_id IS NOT NULL)`,
			)
			.get(...ids) as { c: number };
		return row.c;
	}

	private purgeHistory(kind: HistoryKind, ids: string[]): number {
		switch (kind) {
			case "search":
				return this.history.purgeSearch(ids);
			case "brief":
				return this.history.purgeBrief(ids);
			case "generated":
				return this.history.purgeGenerated(ids);
		}
	}
}
