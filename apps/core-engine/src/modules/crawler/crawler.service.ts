import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { eq, inArray } from "drizzle-orm";
import { DatabaseService } from "../../db/database.service.js";
import { articles, sources } from "../../db/schema.js";
import {
	attachSpine,
	createSpine,
	hasSpine,
	sweepOrphanSpines,
} from "../../db/spine.js";
import { ftsInsertArticle, ftsUpdateArticle } from "../../db/fts-sync.js";
import type { Article } from "@vorynth/types";
import type { SourceAdapter } from "./source-adapter.js";
import { RssAdapter } from "./adapters/rss-adapter.js";
import { GithubReleasesAdapter } from "./adapters/github-releases-adapter.js";
import { ArxivAdapter } from "./adapters/arxiv-adapter.js";
import { HtmlAdapter } from "./adapters/html-adapter.js";
import { SitemapAdapter } from "./adapters/sitemap-adapter.js";
import { ApiAdapter } from "./adapters/api-adapter.js";
import { RedditAdapter } from "./adapters/reddit-adapter.js";
import { PluginsService } from "../plugins/plugins.service.js";
import { SourceListsService } from "../sources/source-lists.service.js";
import { articleHash } from "./hashing.js";
import { enrichArticle, mapWithConcurrency } from "./full-text.js";
import {
	isContentCorrupted,
	needsParagraphRepair,
	needsShellRepair,
} from "./content-quality.js";

/**
 * Crawler service — runs source adapters and persists collected articles,
 * deduping by `hash` (project-details.md §20).
 *
 * v1.8.0: adapter plugins are manifest-registered in `PluginsService`. A source
 * is only collected when its adapter is registered here AND enabled there —
 * disabled adapters are skipped (the registry's enable/disable is the plugin
 * system's user-facing knob, project-details.md §27). Sources that belong to a
 * source list are additionally gated on their list's master switch.
 */
@Injectable()
export class CrawlerService implements OnModuleInit {
	private readonly logger = new Logger("Crawler");
	private readonly adapters = new Map<string, SourceAdapter>();

	constructor(
		@Inject(DatabaseService) private readonly db: DatabaseService,
		@Inject(PluginsService) private readonly plugins: PluginsService,
		@Inject(SourceListsService) private readonly lists: SourceListsService,
	) {}

	onModuleInit() {
		this.register(new RssAdapter());
		this.register(new GithubReleasesAdapter());
		this.register(new ArxivAdapter());
		this.register(new HtmlAdapter());
		this.register(new SitemapAdapter());
		this.register(new ApiAdapter());
		this.register(new RedditAdapter());
	}

	register(adapter: SourceAdapter): void {
		this.adapters.set(adapter.name, adapter);
		this.logger.log(`registered adapter: ${adapter.name}`);
	}

	/** Collect from a single source by id. */
	async collectSource(
		sourceId: string,
		opts?: { force?: boolean },
	): Promise<Article[]> {
		const [src] = await this.db.db
			.select()
			.from(sources)
			.where(eq(sources.id, sourceId))
			.limit(1);

		if (!src) throw new Error(`source not found: ${sourceId}`);
		if (!src.enabled) {
			this.logger.warn(`source disabled, skipping: ${src.name}`);
			return [];
		}

		// Source lists (v1.8.0): a source that belongs to a list is only
		// collected while the list's master switch is on. Rows are kept — the
		// list's sources reappear (with edits intact) when it is re-enabled.
		if (src.listId) {
			const enabledLists = await this.lists.getEnabledListIds();
			if (!enabledLists.has(src.listId)) {
				this.logger.warn(
					`source list '${src.listId}' disabled, skipping: ${src.name}`,
				);
				return [];
			}
		}

		const adapter = this.adapters.get(src.adapter);
		if (!adapter) throw new Error(`no adapter registered for '${src.adapter}'`);

		// Plugin system (v1.8.0): the adapter must be enabled in the registry.
		if (!(await this.plugins.isEnabled(src.adapter))) {
			this.logger.warn(
				`adapter plugin '${src.adapter}' is disabled, skipping: ${src.name}`,
			);
			return [];
		}

		const config = src.configuration ?? {};
		const valid = await adapter.validate(config);
		if (!valid)
			throw new Error(
				`adapter '${src.adapter}' rejected config for ${src.name}`,
			);

		const rawItems = await adapter.fetch(config);
		const parsed: Article[] = rawItems.map((it) =>
			adapter.parse(it, {
				sourceId: src.id,
				hash: "",
			}),
		);

		// Recompute hashes after parsing (adapter sets ctx.hash="" placeholder).
		for (const a of parsed) {
			(a as Article).hash = articleHash({
				title: a.title,
				publishedAt: a.publishedAt,
				sourceId: a.sourceId,
			});
		}

		// Apply the per-source fetch window (default 7 days). Drop anything
		// older than the window so the local DB only holds what's in scope.
		// v1.6.0: an absolute time range (fetchFrom set) overrides the relative
		// window — keep articles published within [fetchFrom, fetchTo].
		const windowDays = src.fetchWindowDays ?? 7;
		const absoluteRange = src.fetchFrom != null;
		const inWindow = absoluteRange
			? filterByAbsoluteRange(parsed, src.fetchFrom, src.fetchTo)
			: windowDays > 0
				? filterByWindow(parsed, windowDays)
				: parsed;

		const stored = await this.persistDeduped(
			inWindow,
			opts?.force,
			enrichArticle,
		);

		// Prune articles outside the source's scope (keeps the DB tidy across
		// runs even when sources change their window later).
		if (absoluteRange) {
			await this.pruneOutsideRange(src.id, src.fetchFrom, src.fetchTo);
		} else if (windowDays > 0) {
			await this.pruneOlderThan(src.id, windowDays);
		}

		// Update lastCheckedAt.
		await this.db.db
			.update(sources)
			.set({ lastCheckedAt: new Date() })
			.where(eq(sources.id, src.id));

		this.logger.log(
			`collected ${stored.length} new articles from ${src.name} (window ${windowDays}d)`,
		);
		return stored;
	}

	/**
	 * Dry-run a source configuration (v1.8.0): validate + fetch, WITHOUT
	 * persisting. Powers `POST /sources/verify` — the Add Source form's "Test"
	 * button. Capped by each adapter's own fetch budget; returns samples so the
	 * user can sanity-check what the adapter would collect.
	 */
	async verifySource(
		adapterName: string,
		configuration: Record<string, unknown>,
	): Promise<{
		ok: boolean;
		error?: string;
		itemCount: number;
		samples: string[];
	}> {
		const adapter = this.adapters.get(adapterName);
		if (!adapter) {
			return {
				ok: false,
				error: `no adapter registered for '${adapterName}'`,
				itemCount: 0,
				samples: [],
			};
		}
		if (!(await this.plugins.isEnabled(adapterName))) {
			return {
				ok: false,
				error: `adapter '${adapterName}' is disabled`,
				itemCount: 0,
				samples: [],
			};
		}
		try {
			const valid = await adapter.validate(configuration);
			if (!valid) {
				return {
					ok: false,
					error: `adapter '${adapterName}' rejected this configuration`,
					itemCount: 0,
					samples: [],
				};
			}
			const items = await adapter.fetch(configuration);
			return {
				ok: true,
				itemCount: items.length,
				samples: items.slice(0, 5).map((i) => i.title),
			};
		} catch (err) {
			return {
				ok: false,
				error: (err as Error).message,
				itemCount: 0,
				samples: [],
			};
		}
	}

	/** Count enabled sources (used by the collect job to size its progress bar).
	 * v1.8.0: sources belonging to a disabled list don't count — collectAll
	 * skips them, so the progress bar must too. */
	async enabledCount(): Promise<number> {
		const rows = await this.db.db
			.select({ id: sources.id, listId: sources.listId })
			.from(sources)
			.where(eq(sources.enabled, true));
		if (rows.length === 0) return 0;
		const enabledLists = await this.lists.getEnabledListIds();
		return rows.filter((r) => !r.listId || enabledLists.has(r.listId)).length;
	}

	/**
	 * Collect from all enabled sources that have a registered adapter.
	 * `onProgress` is invoked after each source finishes so the job runner can
	 * surface live per-source progress to the UI.
	 */
	async collectAll(
		onProgress?: (info: {
			done: number;
			total: number;
			sourceName: string;
			collected: number;
		}) => void,
		opts?: { force?: boolean },
	): Promise<{ sourceId: string; collected: number }[]> {
		// v1.8.0 — precompute the enabled-list set ONCE per run and drop the
		// sources of disabled lists before iterating (their list is the master
		// switch: off = the whole group is paused, rows kept).
		const enabledLists = await this.lists.getEnabledListIds();
		const enabled = (
			await this.db.db.select().from(sources).where(eq(sources.enabled, true))
		).filter((s) => !s.listId || enabledLists.has(s.listId));
		const total = enabled.length;
		const results: { sourceId: string; collected: number }[] = [];
		let done = 0;
		for (const src of enabled) {
			if (!this.adapters.has(src.adapter)) {
				this.logger.warn(
					`no adapter for ${src.name} (${src.adapter}), skipping`,
				);
				done += 1;
				onProgress?.({ done, total, sourceName: src.name, collected: 0 });
				continue;
			}
			try {
				const got = await this.collectSource(src.id, opts);
				results.push({ sourceId: src.id, collected: got.length });
			} catch (err) {
				this.logger.error(
					`failed collecting ${src.name}: ${(err as Error).message}`,
				);
				results.push({ sourceId: src.id, collected: 0 });
			}
			done += 1;
			onProgress?.({
				done,
				total,
				sourceName: src.name,
				collected: results[results.length - 1]?.collected ?? 0,
			});
		}
		return results;
	}

	/**
	 * Data-health backfill (v1.8.0): fetch the full text of already-stored
	 * articles whose content is empty or a short snippet. This is the healing
	 * pass for articles collected before full-text enrichment existed — it runs
	 * from the background health-check job, not the routine collect.
	 *
	 * Only rows with a fetchable URL and content below the full-text threshold
	 * are touched; `enrichArticle` keeps the snippet on any failure (best-effort,
	 * never a downgrade). Upgraded rows are re-FTS-synced so search matches the
	 * new body. Returns the ids whose content was upgraded AND that carried a
	 * body translation — those translations are now stale and must be repaired
	 * by the health-check's translation phase.
	 *
	 * @returns `{ upgraded: number; staleTranslationIds: string[] }`
	 */
	async backfillFullText(
		onProgress?: (done: number, total: number) => void,
		throwIfCanceled?: () => void,
		cap = 200,
	): Promise<{ upgraded: number; staleTranslationIds: string[] }> {
		const rows = this.db.rawDb
			.prepare(
				`SELECT id, title, content, url, author, original_title, translated_content
				 FROM articles
				 WHERE url != ''
				   AND (content = '' OR LENGTH(content) < 800)
				 ORDER BY collected_at DESC
				 LIMIT ?`,
			)
			.all(cap) as Array<{
			id: string;
			title: string;
			content: string;
			url: string;
			author: string | null;
			original_title: string | null;
			translated_content: string | null;
		}>;

		if (rows.length === 0) return { upgraded: 0, staleTranslationIds: [] };

		const updateStmt = this.db.rawDb.prepare(
			`UPDATE articles SET content = ?, author = ? WHERE id = ?`,
		);
		const staleTranslationIds: string[] = [];
		let upgraded = 0;
		let done = 0;

		await mapWithConcurrency(rows, async (row) => {
			throwIfCanceled?.();
			const enriched = await enrichArticle({
				id: row.id,
				sourceId: "",
				title: row.title,
				content: row.content,
				url: row.url,
				author: row.author,
				publishedAt: null,
				collectedAt: new Date(),
				hash: "",
			});
			if (enriched.content !== row.content || enriched.author !== row.author) {
				updateStmt.run(enriched.content, enriched.author ?? null, row.id);
				// Keep the FTS index in sync with the rewritten body.
				ftsUpdateArticle(
					this.db.rawDb,
					row.id,
					enriched.title,
					enriched.content,
					enriched.author,
					row.original_title,
				);
				upgraded += 1;
				if ((row.translated_content ?? "") !== "") {
					staleTranslationIds.push(row.id);
				}
			}
			done += 1;
			onProgress?.(done, rows.length);
			return { ...row, content: enriched.content, author: enriched.author };
		});

		this.logger.log(
			`health backfill: ${upgraded}/${rows.length} articles upgraded (${staleTranslationIds.length} stale translations to repair)`,
		);
		return { upgraded, staleTranslationIds };
	}

	/** Count of stored articles that are empty or snippet-only (for the health
	 *  check's progress bar). */
	backfillCandidateCount(): number {
		const { c } = this.db.rawDb
			.prepare(
				"SELECT COUNT(*) AS c FROM articles WHERE url != '' AND (content = '' OR LENGTH(content) < 800)",
			)
			.get() as { c: number };
		return c;
	}

	/**
	 * Per-story re-collect (v1.8.0): re-fetch THIS article's origin and rewrite
	 * its stored body with a fresh extraction. Runs with `force` so an
	 * already-full (or damaged) body is re-extracted, and a damaged body is
	 * swapped for a clean one. Translations are NOT touched here — the caller
	 * (IntelligenceService.recollectStory) repairs a stale body translation
	 * after a content change (R-C04).
	 *
	 * @returns whether the stored body changed and whether it carried a body
	 *   translation that is now stale.
	 */
	async recollectArticleContent(articleId: string): Promise<{
		changed: boolean;
		hadTranslation: boolean;
		content: string;
		author: string | null;
	}> {
		const row = this.db.rawDb
			.prepare(
				`SELECT id, title, content, url, author, original_title, translated_content
				 FROM articles WHERE id = ?`,
			)
			.get(articleId) as
			| {
					id: string;
					title: string;
					content: string;
					url: string;
					author: string | null;
					original_title: string | null;
					translated_content: string | null;
			  }
			| undefined;
		if (!row) throw new Error(`article not found: ${articleId}`);
		const hadTranslation = (row.translated_content ?? "") !== "";
		if (!row.url.trim()) {
			return {
				changed: false,
				hadTranslation,
				content: row.content,
				author: row.author,
			};
		}

		const enriched = await enrichArticle(
			{
				id: row.id,
				sourceId: "",
				title: row.title,
				content: row.content,
				url: row.url,
				author: row.author,
				publishedAt: null,
				collectedAt: new Date(),
				hash: "",
			},
			{ force: true },
		);
		const changed =
			enriched.content !== row.content || enriched.author !== row.author;
		if (changed) {
			this.db.rawDb
				.prepare("UPDATE articles SET content = ?, author = ? WHERE id = ?")
				.run(enriched.content, enriched.author ?? null, row.id);
			// Keep the FTS index in sync with the rewritten body.
			ftsUpdateArticle(
				this.db.rawDb,
				row.id,
				enriched.title,
				enriched.content,
				enriched.author,
				row.original_title,
			);
			this.logger.log(`re-collected article ${row.id}: body updated`);
		}
		return {
			changed,
			hadTranslation,
			content: enriched.content,
			author: enriched.author,
		};
	}

	/**
	 * Content-verification pass (v1.8.0): find stored bodies that look damaged
	 * (inline JSON blobs / media-player chrome — the artifact of extraction
	 * before the script/JSON cleanup) and re-extract them from the origin with
	 * `force`. A clean extraction replaces the damaged body; anything else
	 * keeps it. Bodies that changed AND carried a translation report a
	 * stale-translation id so the health job can repair them.
	 *
	 * @returns `{ repaired: number; staleTranslationIds: string[] }`
	 */
	async backfillCorruptedContent(
		onProgress?: (done: number, total: number) => void,
		throwIfCanceled?: () => void,
		cap = 200,
	): Promise<{ repaired: number; staleTranslationIds: string[] }> {
		// Loose SQL pre-filter (corruption is a JS heuristic) — narrow the scan
		// to bodies that plausibly carry JSON blobs, `[[placeholder]]` tokens,
		// media-player chrome, a page-shell byline (Cloudflare COPY URL / AWS
		// Permalink Comments Share), or are long but flattened (no blank line —
		// the old extractor's wall-of-words output).
		const rows = this.db.rawDb
			.prepare(
				`SELECT id, title, content, url, author, translated_content
					 FROM articles
					 WHERE url != ''
					   AND (content LIKE '%[[%' OR content LIKE '%{%'
					     OR content LIKE '%play_video%' OR content LIKE '%listen to article%'
					     OR content LIKE '%browser does not support%'
					     OR content LIKE '%COPY URL%'
					     OR content LIKE '%Permalink Comments Share%'
					     OR (length(content) > 1500
					         AND content NOT LIKE '%' || char(10) || char(10) || '%'))
					 ORDER BY collected_at DESC
					 LIMIT ?`,
			)
			.all(cap) as Array<{
			id: string;
			title: string;
			content: string;
			url: string;
			author: string | null;
			original_title: string | null;
			translated_content: string | null;
		}>;
		const damaged = rows.filter(
			(r) =>
				isContentCorrupted(r.content) ||
				needsShellRepair(r.content) ||
				needsParagraphRepair(r.content),
		);
		if (damaged.length === 0) return { repaired: 0, staleTranslationIds: [] };

		const updateStmt = this.db.rawDb.prepare(
			"UPDATE articles SET content = ?, author = ? WHERE id = ?",
		);
		const staleTranslationIds: string[] = [];
		let repaired = 0;
		let done = 0;

		await mapWithConcurrency(damaged, async (row) => {
			throwIfCanceled?.();
			const enriched = await enrichArticle(
				{
					id: row.id,
					sourceId: "",
					title: row.title,
					content: row.content,
					url: row.url,
					author: row.author,
					publishedAt: null,
					collectedAt: new Date(),
					hash: "",
				},
				{ force: true },
			);
			if (enriched.content !== row.content || enriched.author !== row.author) {
				updateStmt.run(enriched.content, enriched.author ?? null, row.id);
				ftsUpdateArticle(
					this.db.rawDb,
					row.id,
					enriched.title,
					enriched.content,
					enriched.author,
					row.original_title,
				);
				repaired += 1;
				if ((row.translated_content ?? "") !== "") {
					staleTranslationIds.push(row.id);
				}
			}
			done += 1;
			onProgress?.(done, damaged.length);
			return { ...row, content: enriched.content, author: enriched.author };
		});

		this.logger.log(
			`health corruption check: ${repaired}/${damaged.length} bodies repaired (${staleTranslationIds.length} stale translations)`,
		);
		return { repaired, staleTranslationIds };
	}

	/**
	 * Persist articles, deduplicating by hash.
	 *
	 * In normal mode (`force=false`, the default), articles whose hash already
	 * exists are skipped — only genuinely new articles are inserted.
	 *
	 * In force mode (`force=true`), existing rows with a matching hash are
	 * **updated** in place (content, author, url, title, collectedAt are
	 * refreshed). The row id stays constant, so related data (insights, media)
	 * is preserved. This is the "re-collect" behaviour.
	 *
	 * `enrich` (v1.8.0 full-text) is applied ONLY to the articles that will
	 * actually be written — fresh ones in normal mode, all of them in force
	 * mode — so an already-stored article is never re-fetched on a routine run.
	 * Enrichment happens before the transaction (it's network I/O); the insert
	 * + FTS sync + spine link stay atomic.
	 */
	private async persistDeduped(
		items: Article[],
		force?: boolean,
		enrich?: (a: Article) => Promise<Article>,
	): Promise<Article[]> {
		if (items.length === 0) return [];

		const raw = this.db.rawDb;

		// Raw SQL for the write path so the article insert, FTS sync, and spine
		// link run atomically (R-A09). NOTE: better-sqlite3's `db.transaction(fn)`
		// RETURNS a function — it must be invoked (`... } )()`); forgetting the
		// trailing `()` silently discards the whole transaction.
		const INSERT_ARTICLE = raw.prepare(
			`INSERT INTO articles (id, source_id, title, content, url, author, published_at, collected_at, hash)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		);
		const UPSERT_ARTICLE = raw.prepare(
			`INSERT INTO articles (id, source_id, title, content, url, author, published_at, collected_at, hash)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			 ON CONFLICT(hash) DO UPDATE SET
			   content = excluded.content,
			   author = excluded.author,
			   url = excluded.url,
			   title = excluded.title,
			   collected_at = excluded.collected_at`,
		);
		const syncArticle = (a: Article) => {
			ftsInsertArticle(
				raw,
				a.id,
				a.title,
				a.content,
				toAuthorString(a.author),
				a.originalTitle,
			);
			this.ensureArticleSpine(a);
		};
		const articleArgs = (a: Article) => [
			a.id,
			a.sourceId,
			a.title,
			a.content,
			a.url,
			toAuthorString(a.author),
			a.publishedAt?.getTime() ?? null,
			a.collectedAt.getTime(),
			a.hash,
		];
		// Full-text upgrade for the items being written, then one atomic insert/
		// upsert + FTS + spine transaction.
		const store = async (list: Article[]): Promise<Article[]> => {
			const enriched = enrich ? await mapWithConcurrency(list, enrich) : list;
			raw.transaction(() => {
				for (const a of enriched) {
					(force ? UPSERT_ARTICLE : INSERT_ARTICLE).run(...articleArgs(a));
					syncArticle(a);
				}
			})();
			return enriched;
		};

		if (force) {
			// Upsert mode: insert or update on hash conflict; refresh content,
			// author, url, title, collectedAt. Spine + FTS sync in the same
			// transaction (R-A09/R-A10). All items were upserted — return all.
			return store(items);
		}

		// Normal (dedup) mode: skip hashes already present.
		const hashes = items.map((i) => i.hash);
		const existing = await this.db.db
			.select({ hash: articles.hash })
			.from(articles)
			.where(inArray(articles.hash, hashes));
		const seen = new Set(existing.map((r) => r.hash));

		const fresh = items.filter((i) => !seen.has(i.hash));
		if (fresh.length === 0) return [];
		return store(fresh);
	}

	/**
	 * Attach an archive spine to an article. Idempotent — force re-collects
	 * keep the existing spine (and anything built on it: bookmarks, notes,
	 * collections).
	 */
	private ensureArticleSpine(a: Article): void {
		const raw = this.db.rawDb;
		if (hasSpine(raw, "articles", a.id)) return;
		const spineId = createSpine(raw, "article", a.collectedAt);
		attachSpine(raw, "articles", a.id, spineId);
	}

	/**
	 * Delete this source's articles older than `windowDays` (by publishedAt).
	 *
	 * Retention (R-A10): bookmarked articles are NEVER pruned — a bookmark is
	 * user ownership of a reference, and silently destroying it is a promise
	 * broken. Non-bookmarked rows older than the window are removed; FTS5
	 * entries become invisible via the search query's INNER JOIN.
	 *
	 * Public so the domain-invariant tests can exercise the real retention
	 * path (the rule lives in the SQL, not in a wrapper).
	 */
	async pruneOlderThan(sourceId: string, windowDays: number) {
		const cutoff = new Date(Date.now() - windowDays * 86_400_000);
		// Retention deletes articles in the same transaction as the orphan-spine
		// sweep (R-A10): a pruned article must never leave a ghost "Untitled"
		// Archive item behind. Bookmarked articles are never pruned.
		this.db.rawDb.transaction(() => {
			this.db.rawDb
				.prepare(
					`DELETE FROM articles
					 WHERE source_id = ? AND published_at < ?
					   AND content_item_id NOT IN (SELECT content_item_id FROM bookmarks WHERE content_item_id IS NOT NULL)`,
				)
				.run(sourceId, cutoff.getTime());
			sweepOrphanSpines(this.db.rawDb);
		})();
	}

	/**
	 * v1.6.0 — absolute time range mode. Deletes this source's articles that
	 * fall OUTSIDE [fetchFrom, fetchTo] (by publishedAt). Bookmarked articles
	 * are never pruned (R-A10), exactly like the relative window — and orphaned
	 * spines are swept in the same transaction.
	 */
	async pruneOutsideRange(
		sourceId: string,
		from: Date | null,
		to: Date | null,
	) {
		// Raw SQL in one transaction (better-sqlite3 transactions are
		// synchronous) — the article delete + orphan-spine sweep are atomic.
		const raw = this.db.rawDb;
		raw.transaction(() => {
			const clauses = ["source_id = ?"];
			const params: unknown[] = [sourceId];
			if (from) {
				clauses.push("published_at < ?");
				params.push(from.getTime());
			}
			if (to) {
				clauses.push("published_at > ?");
				params.push(to.getTime());
			}
			clauses.push(
				"content_item_id NOT IN (SELECT content_item_id FROM bookmarks WHERE content_item_id IS NOT NULL)",
			);
			raw
				.prepare(`DELETE FROM articles WHERE ${clauses.join(" AND ")}`)
				.run(...params);
			sweepOrphanSpines(raw);
		})();
	}
}

/**
 * Coerce an author value to a plain string before it reaches SQL.
 *
 * `Article.author` is typed `string | null`, but adapters (including
 * untrusted plugin adapters, R-A13) feed this path external data — a
 * non-string author must never crash a source's whole collect and roll back
 * its articles (a better-sqlite3 bind failure). Null it instead; the adapter
 * boundary is the place that preserves the real author (see RssAdapter).
 */
function toAuthorString(author: unknown): string | null {
	return typeof author === "string" ? author : null;
}

/** Keep only articles published within the last `windowDays`. */
function filterByWindow(items: Article[], windowDays: number): Article[] {
	const cutoff = Date.now() - windowDays * 86_400_000;
	return items.filter((a) => {
		// No publishedAt → keep (we can't judge age; let the dedup hash decide).
		if (!a.publishedAt) return true;
		return a.publishedAt.getTime() >= cutoff;
	});
}

/** v1.6.0 — keep only articles published within [from, to] (absolute range). */
function filterByAbsoluteRange(
	items: Article[],
	from: Date | null,
	to: Date | null,
): Article[] {
	return items.filter((a) => {
		if (!a.publishedAt) return true; // no date → keep; hash decides
		const t = a.publishedAt.getTime();
		if (from && t < from.getTime()) return false;
		if (to && t > to.getTime()) return false;
		return true;
	});
}
