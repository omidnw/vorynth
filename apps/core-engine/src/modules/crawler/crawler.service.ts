import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { DatabaseService } from "../../db/database.service.js";
import { articles, sources } from "../../db/schema.js";
import { ftsInsertArticle } from "../../db/fts-sync.js";
import type { Article } from "@vorynth/types";
import type { SourceAdapter } from "./source-adapter.js";
import { RssAdapter } from "./adapters/rss-adapter.js";
import { GithubReleasesAdapter } from "./adapters/github-releases-adapter.js";
import { ArxivAdapter } from "./adapters/arxiv-adapter.js";
import { articleHash } from "./hashing.js";

/**
 * Crawler service — runs source adapters and persists collected articles,
 * deduping by `hash` (project-details.md §20).
 *
 * For the vertical slice the only adapter is RSS; the registry pattern means
 * adding GitHub/Reddit/arXiv/sitemap/HTML adapters later is a registration,
 * not a code change in this service (§27).
 */
@Injectable()
export class CrawlerService implements OnModuleInit {
	private readonly logger = new Logger("Crawler");
	private readonly adapters = new Map<string, SourceAdapter>();

	constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

	onModuleInit() {
		this.register(new RssAdapter());
		this.register(new GithubReleasesAdapter());
		this.register(new ArxivAdapter());
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

		const adapter = this.adapters.get(src.adapter);
		if (!adapter) throw new Error(`no adapter registered for '${src.adapter}'`);

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
		const windowDays = src.fetchWindowDays ?? 7;
		const inWindow =
			windowDays > 0 ? filterByWindow(parsed, windowDays) : parsed;

		const stored = await this.persistDeduped(inWindow, opts?.force);

		// Prune articles for this source older than the window (keeps the DB
		// tidy across runs even when sources change their window later).
		if (windowDays > 0) {
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

	/** Count enabled sources (used by the collect job to size its progress bar). */
	async enabledCount(): Promise<number> {
		const rows = await this.db.db
			.select({ id: sources.id })
			.from(sources)
			.where(eq(sources.enabled, true));
		return rows.length;
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
		const enabled = await this.db.db
			.select()
			.from(sources)
			.where(eq(sources.enabled, true));
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
	 * Persist articles, deduplicating by hash.
	 *
	 * In normal mode (`force=false`, the default), articles whose hash already
	 * exists are skipped — only genuinely new articles are inserted.
	 *
	 * In force mode (`force=true`), existing rows with a matching hash are
	 * **updated** in place (content, author, url, title, collectedAt are
	 * refreshed). The row id stays constant, so related data (insights, media)
	 * is preserved. This is the "re-collect" behaviour.
	 */
	private async persistDeduped(
		items: Article[],
		force?: boolean,
	): Promise<Article[]> {
		if (items.length === 0) return [];

		if (force) {
			// Upsert mode: insert or update on hash conflict. The `excluded`
			// pseudo-table carries the proposed new values.
			await this.db.db
				.insert(articles)
				.values(
					items.map((a) => ({
						id: a.id,
						sourceId: a.sourceId,
						title: a.title,
						content: a.content,
						url: a.url,
						author: a.author,
						publishedAt: a.publishedAt,
						collectedAt: a.collectedAt,
						hash: a.hash,
					})),
				)
				.onConflictDoUpdate({
					target: articles.hash,
					set: {
						content: sql`excluded.content`,
						author: sql`excluded.author`,
						url: sql`excluded.url`,
						title: sql`excluded.title`,
						collectedAt: sql`excluded.collected_at`,
					},
				});

			// Sync all upserted items into FTS5 (re-insert with new content;
			// deduplication in the search query handles stale entries).
			for (const a of items) {
				ftsInsertArticle(this.db.rawDb, a.id, a.title, a.content);
			}

			// In force mode, all items were upserted — return all of them.
			return items;
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

		// Insert; on hash conflict, do nothing (extra safety against races).
		await this.db.db
			.insert(articles)
			.values(
				fresh.map((a) => ({
					id: a.id,
					sourceId: a.sourceId,
					title: a.title,
					content: a.content,
					url: a.url,
					author: a.author,
					publishedAt: a.publishedAt,
					collectedAt: a.collectedAt,
					hash: a.hash,
				})),
			)
			.onConflictDoNothing({ target: articles.hash });

		// Sync fresh articles into FTS5 index.
		for (const a of fresh) {
			ftsInsertArticle(this.db.rawDb, a.id, a.title, a.content);
		}

		return fresh;
	}

	/** Delete this source's articles older than `windowDays` (by publishedAt). */
	private async pruneOlderThan(sourceId: string, windowDays: number) {
		const cutoff = new Date(Date.now() - windowDays * 86_400_000);
		await this.db.db
			.delete(articles)
			.where(
				and(eq(articles.sourceId, sourceId), lt(articles.publishedAt, cutoff)),
			);
		// NOTE: FTS5 entries for pruned articles are not explicitly deleted;
		// they become invisible because the search query INNER JOINs with the
		// articles table (deleted rows produce no match).
	}
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
