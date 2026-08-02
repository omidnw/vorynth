import {
	ConflictException,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { DatabaseService } from "../../db/database.service.js";
import {
	articles,
	briefHistory,
	collections,
	generatedHistory,
	searchHistory,
} from "../../db/schema.js";
import type {
	ArchiveItem,
	ArchiveItemList,
	Collection,
	CollectionKind,
	CollectionList,
	ContentItemType,
	CreateCollectionInput,
	UpdateArchiveItemInput,
	UpdateCollectionInput,
} from "@vorynth/types";

/** Soft cap on collection nesting: category(1) → folder(2) → folder(3). */
export const MAX_COLLECTION_DEPTH = 3;

/**
 * Raw spine row as returned by the archive's SQL queries — columns are
 * aliased to camelCase here; timestamp columns are epoch-ms integers (the
 * Drizzle `ContentItemRow` type lies about Dates, so we don't reuse it).
 */
interface RawContentItem {
	id: string;
	contentType: string;
	note: string | null;
	collectionId: string | null;
	archivedAt: number | null;
	createdAt: number;
	updatedAt: number;
	bookmarked: number;
}

const SPINE_SELECT = `
  SELECT ci.id,
         ci.content_type AS contentType,
         ci.note,
         ci.collection_id AS collectionId,
         ci.archived_at AS archivedAt,
         ci.created_at AS createdAt,
         ci.updated_at AS updatedAt,
         EXISTS (SELECT 1 FROM bookmarks b WHERE b.content_item_id = ci.id) AS bookmarked
  FROM content_items ci
`;

/**
 * Archive service (v1.6.0) — the unified user-owned intelligence space.
 *
 * `content_items` is the metadata-only spine (R-A09): notes, tags, collection
 * membership and bookmarks live here; title/url/content stay in the origin
 * tables and are joined at read time. Collections follow R-A11 (category =
 * semantic root, folder = manual nesting, depth ≤ MAX_COLLECTION_DEPTH).
 */
@Injectable()
export class ArchiveService {
	constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

	// ── Items ────────────────────────────────────────────────────────────────

	/**
	 * List archive items.
	 *
	 * Defaults: non-archived only, curated order (bookmarked first, then newest).
	 * Pass `archived=true` to see archived items; `archived=undefined` shows the
	 * live items. `q` searches notes AND origin titles (LIKE — adequate at local
	 * volumes; `archive_fts` is the planned follow-up).
	 */
	async listItems(opts: {
		contentType?: string;
		collectionId?: string;
		tag?: string;
		q?: string;
		archived?: boolean;
		bookmarked?: boolean;
		limit?: number;
		offset?: number;
	}): Promise<ArchiveItemList> {
		const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
		const offset = Math.max(opts.offset ?? 0, 0);
		const raw = this.db.rawDb;

		const where: string[] = [];
		const params: unknown[] = [];

		// By default, archived items are hidden — only show them when explicitly
		// requested (`archived=true`). `undefined` = live items only.
		if (opts.archived === true) where.push("ci.archived_at IS NOT NULL");
		else where.push("ci.archived_at IS NULL");

		if (opts.contentType) {
			where.push("ci.content_type = ?");
			params.push(opts.contentType);
		}
		if (opts.collectionId === "none") {
			where.push("ci.collection_id IS NULL");
		} else if (opts.collectionId !== undefined && opts.collectionId !== "") {
			where.push("ci.collection_id = ?");
			params.push(opts.collectionId);
		}
		if (opts.tag) {
			where.push(
				"EXISTS (SELECT 1 FROM content_item_tags cit JOIN tags t ON t.id = cit.tag_id WHERE cit.content_item_id = ci.id AND t.name = ?)",
			);
			params.push(opts.tag);
		}
		if (opts.q && opts.q.trim()) {
			const needle = `%${opts.q.trim()}%`;
			where.push(
				`(ci.note LIKE ? OR ci.id IN (SELECT content_item_id FROM articles WHERE title LIKE ?)
				 OR ci.id IN (SELECT content_item_id FROM search_history WHERE title LIKE ? OR query LIKE ?)
				 OR ci.id IN (SELECT content_item_id FROM brief_history WHERE title LIKE ?)
				 OR ci.id IN (SELECT content_item_id FROM generated_history WHERE title LIKE ?))`,
			);
			params.push(needle, needle, needle, needle, needle, needle);
		}
		if (opts.bookmarked === true)
			where.push(
				"EXISTS (SELECT 1 FROM bookmarks b WHERE b.content_item_id = ci.id)",
			);
		if (opts.bookmarked === false)
			where.push(
				"NOT EXISTS (SELECT 1 FROM bookmarks b WHERE b.content_item_id = ci.id)",
			);

		// Bookmarked items float to the top in the default (no-filter) view; any
		// active filter switches to plain newest-first.
		const hasFilters = Boolean(
			opts.contentType ||
				opts.collectionId !== undefined ||
				opts.tag ||
				opts.q ||
				opts.bookmarked !== undefined,
		);
		const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
		const curatedSql = hasFilters
			? "ci.created_at DESC"
			: `CASE WHEN EXISTS (SELECT 1 FROM bookmarks b WHERE b.content_item_id = ci.id) THEN 0 ELSE 1 END,
			   ci.created_at DESC`;

		const { c: total } = raw
			.prepare(`SELECT COUNT(*) AS c FROM content_items ci ${whereSql}`)
			.get(...params) as { c: number };

		const rows = raw
			.prepare(
				`${SPINE_SELECT}
				 ${whereSql}
				 ORDER BY ${curatedSql}
				 LIMIT ? OFFSET ?`,
			)
			.all(...params, limit, offset) as RawContentItem[];

		const items = await this.resolveOrigins(rows);
		return { items, total, hasMore: offset + items.length < total };
	}

	/** Full archive item, including its origin payload. Throws 404 when missing. */
	async getItem(contentItemId: string): Promise<ArchiveItem> {
		const raw = this.db.rawDb;
		const row = raw
			.prepare(`${SPINE_SELECT} WHERE ci.id = ?`)
			.get(contentItemId) as RawContentItem | undefined;
		if (!row)
			throw new NotFoundException(
				`content item ${contentItemId} not found`,
			);
		const [item] = await this.resolveOrigins([row]);
		return item!;
	}

	/**
	 * Update an item's note, tags, collection, or archived flag. Tags are
	 * replaced wholesale (delete + re-link, upserting names). Collection is
	 * validated; `archived` sets/clears `archived_at`.
	 */
	async updateItem(
		contentItemId: string,
		patch: UpdateArchiveItemInput,
	): Promise<ArchiveItem> {
		const raw = this.db.rawDb;
		const existing = raw
			.prepare("SELECT id FROM content_items WHERE id = ?")
			.get(contentItemId);
		if (!existing)
			throw new NotFoundException(
				`content item ${contentItemId} not found`,
			);

		const now = new Date();
		raw.transaction(() => {
			if (patch.note !== undefined) {
				raw.prepare("UPDATE content_items SET note = ? WHERE id = ?").run(
					patch.note === null ? null : patch.note,
					contentItemId,
				);
			}
			if (patch.collectionId !== undefined) {
				if (patch.collectionId !== null) {
					this.assertCollectionExists(patch.collectionId);
				}
				raw.prepare(
					"UPDATE content_items SET collection_id = ? WHERE id = ?",
				).run(patch.collectionId, contentItemId);
			}
			if (patch.archived !== undefined) {
				raw.prepare(
					"UPDATE content_items SET archived_at = ? WHERE id = ?",
				).run(patch.archived ? now.getTime() : null, contentItemId);
			}
			if (patch.tags !== undefined) {
				this.replaceTags(raw, contentItemId, patch.tags);
			}
			raw.prepare(
				"UPDATE content_items SET updated_at = ? WHERE id = ?",
			).run(now.getTime(), contentItemId);
		})();

		return this.getItem(contentItemId);
	}

	// ── Collections ──────────────────────────────────────────────────────────

	async listCollections(): Promise<CollectionList> {
		const rows = this.db.db.select().from(collections).all();
		return { items: rows.map(toCollectionDto) };
	}

	async createCollection(input: CreateCollectionInput): Promise<Collection> {
		const kind: CollectionKind = input.kind ?? "folder";
		const name = input.name.trim();
		if (input.parentId !== undefined && input.parentId !== null) {
			this.assertValidParent(input.parentId, kind);
		} else if (kind === "folder") {
			// R-A11: categories are the roots; a bare folder has nowhere to live.
			throw new NotFoundException(
				"folder collections require a parent (category or folder)",
			);
		}
		// Same-kind sibling names are unique under a parent — a folder and a
		// category with the same name coexist (their `kind` differs, R-A11).
		this.assertSiblingNameFree(input.parentId ?? null, kind, name);
		const id = randomUUID();
		const now = new Date();
		this.db.db
			.insert(collections)
			.values({
				id,
				name,
				description: input.description ?? null,
				parentId: input.parentId ?? null,
				kind,
				llmGenerated: false,
				createdAt: now,
				updatedAt: now,
			})
			.run();
		return this.getCollection(id);
	}

	async updateCollection(
		id: string,
		patch: UpdateCollectionInput,
	): Promise<Collection> {
		this.assertCollectionExists(id);
		const set: Record<string, unknown> = { updatedAt: new Date() };
		if (patch.name !== undefined) set.name = patch.name.trim();

		// Re-validate against the TARGET state whenever name / parent / kind
		// changes: R-A11 parent rules, plus same-kind sibling name uniqueness
		// (cross-kind same-name stays allowed).
		if (patch.name !== undefined || patch.parentId !== undefined || patch.kind !== undefined) {
			const row = this.db.db
				.select({
					parentId: collections.parentId,
					kind: collections.kind,
					name: collections.name,
				})
				.from(collections)
				.where(eq(collections.id, id))
				.get();
			const nextParentId = patch.parentId ?? row?.parentId ?? null;
			const nextKind = patch.kind ?? row?.kind ?? "folder";
			const nextName = (patch.name ?? row?.name ?? "").trim();
			if (nextParentId) this.assertValidParent(nextParentId, nextKind);
			else if (nextKind === "folder") {
				throw new NotFoundException(
					"folder collections require a parent (category or folder)",
				);
			}
			if (nextName) this.assertSiblingNameFree(nextParentId, nextKind, nextName, id);
		}
		if (patch.description !== undefined) set.description = patch.description;
		if (patch.parentId !== undefined) set.parentId = patch.parentId;
		if (patch.kind !== undefined) set.kind = patch.kind;
		this.db.db
			.update(collections)
			.set(set)
			.where(eq(collections.id, id))
			.run();
		return this.getCollection(id);
	}

	/**
	 * Delete a collection. Items move to uncategorized and child collections
	 * re-parent to the deleted collection's parent — both handled by the FK
	 * ON DELETE SET NULL. Never cascades content deletion (R-A11).
	 */
	async deleteCollection(id: string): Promise<void> {
		this.assertCollectionExists(id);
		this.db.db.delete(collections).where(eq(collections.id, id)).run();
	}

	// ── internals ────────────────────────────────────────────────────────────

	private getCollection(id: string): Collection {
		const row = this.db.db
			.select()
			.from(collections)
			.where(eq(collections.id, id))
			.get();
		if (!row) throw new NotFoundException(`collection ${id} not found`);
		return toCollectionDto(row);
	}

	private assertCollectionExists(id: string): void {
		const row = this.db.db
			.select({ id: collections.id })
			.from(collections)
			.where(eq(collections.id, id))
			.get();
		if (!row) throw new NotFoundException(`collection ${id} not found`);
	}

	/**
	 * Same-kind sibling name uniqueness (R-A11). A folder and a category with
	 * the same name under the same parent coexist — their `kind` differs. Two
	 * folders (or two categories) with the same name under the same parent are
	 * refused with a 409. Comparison is trimmed + case-insensitive, so "Work"
	 * and "work" collide. The DB's partial unique indexes (ddl.ts) are the
	 * race backstop; this check is the primary gate.
	 */
	private assertSiblingNameFree(
		parentId: string | null,
		kind: CollectionKind,
		name: string,
		excludeId?: string,
	): void {
		const params: unknown[] = [parentId, kind, name];
		let where = "parent_id IS ? AND kind = ? AND LOWER(name) = LOWER(?)";
		if (excludeId) {
			where += " AND id != ?";
			params.push(excludeId);
		}
		const clash = this.db.rawDb
			.prepare(`SELECT id FROM collections WHERE ${where}`)
			.get(...params) as { id: string } | undefined;
		if (clash) {
			const label = kind === "category" ? "category" : "folder";
			throw new ConflictException({
				code: "COLLECTION_NAME_CONFLICT",
				message: `A ${label} named "${name}" already exists here.`,
			});
		}
	}

	/**
	 * R-A11 parent rules: category may contain folders only; folder may contain
	 * folders or items; depth ≤ MAX_COLLECTION_DEPTH.
	 */
	private assertValidParent(parentId: string, childKind: CollectionKind): void {
		const parent = this.db.db
			.select()
			.from(collections)
			.where(eq(collections.id, parentId))
			.get();
		if (!parent) throw new NotFoundException(`collection ${parentId} not found`);

		if (childKind === "category" && parent.kind === "category") {
			throw new NotFoundException(
				"categories are semantic roots — nest folders under them, not categories",
			);
		}

		// Depth check: parent's depth + 1 must not exceed the cap.
		let depth = 1;
		let cursor: string | null = parent.id;
		let guard = 0;
		while (cursor && guard++ < MAX_COLLECTION_DEPTH + 2) {
			const row = this.db.db
				.select({ parentId: collections.parentId })
				.from(collections)
				.where(eq(collections.id, cursor))
				.get();
			if (!row) break;
			depth += 1;
			cursor = row.parentId;
		}
		if (depth > MAX_COLLECTION_DEPTH) {
			throw new NotFoundException(
				`collection nesting exceeds the maximum depth of ${MAX_COLLECTION_DEPTH}`,
			);
		}
	}

	private replaceTags(
		raw: Database.Database,
		contentItemId: string,
		tagNames: string[],
	): void {
		raw.prepare("DELETE FROM content_item_tags WHERE content_item_id = ?").run(
			contentItemId,
		);
		const insertTag = raw.prepare(
			"INSERT INTO tags (id, name) VALUES (?, ?) ON CONFLICT(name) DO NOTHING",
		);
		const findTag = raw.prepare("SELECT id FROM tags WHERE name = ?");
		const link = raw.prepare(
			"INSERT OR IGNORE INTO content_item_tags (content_item_id, tag_id) VALUES (?, ?)",
		);
		for (const name of tagNames) {
			const trimmed = name.trim().slice(0, 60);
			if (!trimmed) continue;
			const id = randomUUID();
			insertTag.run(id, trimmed);
			const found = findTag.get(trimmed) as { id: string };
			link.run(contentItemId, found.id);
		}
	}

	/** Batch-resolve origin payloads + tags for a page of spine rows. */
	private async resolveOrigins(rows: RawContentItem[]): Promise<ArchiveItem[]> {
		const raw = this.db.rawDb;
		const ids = rows.map((r) => r.id);
		if (ids.length === 0) return [];

		// Tags for every item in the page, one query.
		const tagRows = raw
			.prepare(
				`SELECT cit.content_item_id AS itemId, t.name AS name
				 FROM content_item_tags cit JOIN tags t ON t.id = cit.tag_id
				 WHERE cit.content_item_id IN (${ids.map(() => "?").join(",")})`,
			)
			.all(...ids) as Array<{ itemId: string; name: string }>;
		const tagsByItem = new Map<string, string[]>();
		for (const tr of tagRows) {
			const list = tagsByItem.get(tr.itemId) ?? [];
			list.push(tr.name);
			tagsByItem.set(tr.itemId, list);
		}

		// Origins per kind.
		const byKind = groupByContentType(rows);
		const originById = new Map<string, unknown>();

		if (byKind.article.length > 0) {
			const articleRows = await this.db.db
				.select()
				.from(articles)
				.where(inArray(articles.contentItemId, byKind.article))
				.all();
			for (const a of articleRows) {
				if (a.contentItemId) originById.set(a.contentItemId, toArticleOrigin(a));
			}
		}
		if (byKind.search.length > 0) {
			const searchRows = await this.db.db
				.select()
				.from(searchHistory)
				.where(inArray(searchHistory.contentItemId, byKind.search))
				.all();
			for (const s of searchRows) {
				if (s.contentItemId) originById.set(s.contentItemId, toSearchOrigin(s));
			}
		}
		if (byKind.brief.length > 0) {
			const briefRows = await this.db.db
				.select()
				.from(briefHistory)
				.where(inArray(briefHistory.contentItemId, byKind.brief))
				.all();
			for (const b of briefRows) {
				if (b.contentItemId) originById.set(b.contentItemId, toBriefOrigin(b));
			}
		}
		if (byKind.generated.length > 0) {
			const generatedRows = await this.db.db
				.select()
				.from(generatedHistory)
				.where(inArray(generatedHistory.contentItemId, byKind.generated))
				.all();
			for (const g of generatedRows) {
				if (g.contentItemId) originById.set(g.contentItemId, toGeneratedOrigin(g));
			}
		}

		return rows.map((r) => {
			const origin = originById.get(r.id);
			const display = displayFields(r, origin);
			return {
				contentItemId: r.id,
				contentType: r.contentType as ContentItemType,
				note: r.note,
				collectionId: r.collectionId,
				archivedAt: r.archivedAt
					? new Date(r.archivedAt).toISOString()
					: null,
				bookmarked: r.bookmarked === 1,
				tags: tagsByItem.get(r.id) ?? [],
				createdAt: new Date(r.createdAt).toISOString(),
				updatedAt: new Date(r.updatedAt).toISOString(),
				title: display.title,
				url: display.url,
				author: display.author,
				publishedAt: display.publishedAt,
				origin: origin ?? null,
			};
		});
	}
}

// ── helpers ─────────────────────────────────────────────────────────────────

function groupByContentType(rows: RawContentItem[]): {
	article: string[];
	search: string[];
	brief: string[];
	generated: string[];
} {
	const article: string[] = [];
	const search: string[] = [];
	const brief: string[] = [];
	const generated: string[] = [];
	for (const r of rows) {
		if (r.contentType === "article") article.push(r.id);
		else if (
			r.contentType === "keyword-search" ||
			r.contentType === "ai-ask"
		)
			search.push(r.id);
		else if (r.contentType === "summary") {
			// A `summary` spine may belong to brief_history or generated_history —
			// we can't tell from the spine alone; both are queried and matched.
			brief.push(r.id);
			generated.push(r.id);
		}
	}
	return { article, search, brief, generated };
}

function displayFields(
	r: RawContentItem,
	origin: unknown,
): {
	title: string | null;
	url: string | null;
	author: string | null;
	publishedAt: string | null;
} {
	if (r.contentType === "article") {
		const a = origin as {
			title?: string;
			url?: string;
			author?: string | null;
			publishedAt?: Date | null;
		} | null;
		return {
			title: a?.title ?? null,
			url: a?.url ?? null,
			author: a?.author ?? null,
			publishedAt: a?.publishedAt
				? (a.publishedAt as Date).toISOString()
				: null,
		};
	}
	const t = origin as { title?: string } | null;
	return { title: t?.title ?? null, url: null, author: null, publishedAt: null };
}

function toArticleOrigin(a: {
	id: string;
	sourceId: string;
	title: string;
	originalTitle: string | null;
	content: string;
	url: string;
	author: string | null;
	publishedAt: Date | null;
	collectedAt: Date;
	hash: string;
	contentItemId: string | null;
}): unknown {
	return {
		id: a.id,
		sourceId: a.sourceId,
		title: a.title,
		originalTitle: a.originalTitle,
		content: a.content,
		url: a.url,
		author: a.author,
		publishedAt: a.publishedAt,
		collectedAt: a.collectedAt,
		hash: a.hash,
		contentItemId: a.contentItemId,
	};
}

function toSearchOrigin(s: {
	id: string;
	query: string;
	mode: string;
	result: unknown;
	title: string;
	archived: boolean;
	tokensUsed: number;
	hitCount: number;
	createdAt: Date;
	updatedAt: Date;
	contentItemId: string | null;
}): unknown {
	return {
		id: s.id,
		query: s.query,
		mode: s.mode,
		result: s.result,
		title: s.title,
		archived: s.archived,
		tokensUsed: s.tokensUsed,
		hitCount: s.hitCount,
		createdAt: s.createdAt.toISOString(),
		updatedAt: s.updatedAt.toISOString(),
		contentItemId: s.contentItemId,
	};
}

function toBriefOrigin(b: {
	id: string;
	period: string;
	periodStart: Date | null;
	periodEnd: Date | null;
	result: unknown;
	title: string;
	archived: boolean;
	storyCount: number;
	createdAt: Date;
	updatedAt: Date;
	contentItemId: string | null;
}): unknown {
	return {
		id: b.id,
		period: b.period,
		periodStart: b.periodStart ? b.periodStart.toISOString() : null,
		periodEnd: b.periodEnd ? b.periodEnd.toISOString() : null,
		result: b.result,
		title: b.title,
		archived: b.archived,
		storyCount: b.storyCount,
		createdAt: b.createdAt.toISOString(),
		updatedAt: b.updatedAt.toISOString(),
		contentItemId: b.contentItemId,
	};
}

function toGeneratedOrigin(g: {
	id: string;
	kind: string;
	title: string;
	result: string;
	tokensUsed: number;
	archived: boolean;
	createdAt: Date;
	updatedAt: Date;
	contentItemId: string | null;
}): unknown {
	return {
		id: g.id,
		kind: g.kind,
		title: g.title,
		result: g.result,
		tokensUsed: g.tokensUsed,
		archived: g.archived,
		createdAt: g.createdAt.toISOString(),
		updatedAt: g.updatedAt.toISOString(),
		contentItemId: g.contentItemId,
	};
}

function toCollectionDto(row: {
	id: string;
	name: string;
	description: string | null;
	parentId: string | null;
	kind: string;
	llmGenerated: boolean;
	createdAt: Date;
	updatedAt: Date;
}): Collection {
	return {
		id: row.id,
		name: row.name,
		description: row.description,
		parentId: row.parentId,
		kind: row.kind as CollectionKind,
		llmGenerated: row.llmGenerated,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	};
}
