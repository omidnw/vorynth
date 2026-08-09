import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import * as os from "node:os";
import { DatabaseService } from "../../db/database.service.js";
import {
	resolveBackupDir,
	resolveDataDir,
	resolveDbPath,
	resolveMediaDir,
	resolvePluginsDir,
} from "../../db/paths.js";
import type { ClearStoriesResult, UsageStats } from "@vorynth/types";

/**
 * Storage + resource usage snapshot (v1.8.0) — the Settings "Storage & Usage"
 * surface.
 *
 * Two halves, intentionally distinct:
 *
 *  1. **On-disk data** — a recursive walk of the data directory split into the
 *     per-library breakdown the UI shows (Database, Media, Backups, Plugins).
 *     Derived/rebuildable, so a plain `fs` walk (not the DB) is the source of
 *     truth: what you see here is what the disk actually holds (R-A09).
 *  2. **Engine resource usage** — `process.memoryUsage` / `cpuUsage` sampled
 *     over a short window so the Settings page can show a live-ish CPU %.
 *
 * `DELETE /stories` lives here too: the "clear all stories" counterpart of the
 * media purge, mirroring the retention sweep's protections (bookmarks + user
 * collections always survive — R-A10) and its orphan-spine cleanup (R-A09).
 */
@Injectable()
export class UsageService {
	private readonly logger = new Logger("Usage");

	/** Time the engine process started — the `startedAt` anchor. */
	private readonly startedAt = new Date();

	/**
	 * Env view resolved once: an explicit `dataDir` override (tests) pins every
	 * path helper to it; production resolves from `VORYNTH_DATA_DIR`/cwd as
	 * usual. Same `@Optional` trick as `DatabaseService(overridePath)`.
	 */
	private readonly env: NodeJS.ProcessEnv;

	constructor(
		@Inject(DatabaseService) private readonly db: DatabaseService,
		@Optional() dataDir?: string,
	) {
		this.env = dataDir
			? { ...process.env, VORYNTH_DATA_DIR: dataDir }
			: process.env;
	}

	/** Build the full usage snapshot. `sampleMs` is the CPU% observation window. */
	async usage(sampleMs = 1200): Promise<UsageStats> {
		const [libraries, stories, processStats, system] = await Promise.all([
			this.measureLibraries(),
			this.measureStories(),
			this.measureProcess(sampleMs),
			this.measureSystem(),
		]);
		const totalBytes = libraries.reduce((s, l) => s + l.bytes, 0);
		return {
			dataDir: resolveDataDir(this.env),
			totalBytes,
			libraries,
			stories,
			process: processStats,
			system,
			measuredAt: new Date().toISOString(),
		};
	}

	/**
	 * Clear all stories — every article except bookmarked ones and ones placed
	 * in a collection (user ownership survives; R-A10). Mirrors the retention
	 * sweep's deletion + orphan-spine cleanup so integrity holds (R-A09).
	 */
	clearStories(): ClearStoriesResult {
		const raw = this.db.rawDb;

		const count = (sql: string, ...params: unknown[]): number => {
			const row = raw.prepare(sql).get(...params) as { c: number };
			return row.c;
		};

		const keptBookmarked = count(
			`SELECT COUNT(*) AS c FROM articles
			 WHERE content_item_id IS NOT NULL
			   AND content_item_id IN (SELECT content_item_id FROM bookmarks)`,
		);
		const keptInCollections = count(
			`SELECT COUNT(*) AS c FROM articles
			 WHERE content_item_id IS NOT NULL
			   AND content_item_id IN (SELECT id FROM content_items WHERE collection_id IS NOT NULL)`,
		);

		// Approximate text bytes that will be freed (same accounting as the
		// stories contentBytes figure — title + content + translation).
		const freed = raw
			.prepare(
				`SELECT COALESCE(SUM(LENGTH(content)) + SUM(LENGTH(COALESCE(title,'')))
					+ SUM(LENGTH(COALESCE(original_title,'')))
					+ SUM(LENGTH(COALESCE(translated_content,''))), 0) AS b
				 FROM articles
				 WHERE (content_item_id IS NULL OR content_item_id NOT IN
						(SELECT content_item_id FROM bookmarks WHERE content_item_id IS NOT NULL))
				   AND (content_item_id IS NULL OR content_item_id NOT IN
						(SELECT id FROM content_items WHERE collection_id IS NOT NULL))`,
			)
			.get() as { b: number };

		// One transaction so a failure mid-way can't leave a half-cleared feed.
		const removed = raw.transaction(() => {
			const changes = raw
				.prepare(
					`DELETE FROM articles
					 WHERE (content_item_id IS NULL OR content_item_id NOT IN
							(SELECT content_item_id FROM bookmarks WHERE content_item_id IS NOT NULL))
					   AND (content_item_id IS NULL OR content_item_id NOT IN
							(SELECT id FROM content_items WHERE collection_id IS NOT NULL))`,
				)
				.run().changes;

			if (changes > 0) {
				// Orphaned spines no longer referenced by any content source
				// (mirrors retention.service.ts + source deletion — R-A09).
				raw
					.prepare(
						`DELETE FROM content_items
						 WHERE id NOT IN (SELECT content_item_id FROM articles WHERE content_item_id IS NOT NULL)
						   AND id NOT IN (SELECT content_item_id FROM search_history WHERE content_item_id IS NOT NULL)
						   AND id NOT IN (SELECT content_item_id FROM brief_history WHERE content_item_id IS NOT NULL)
						   AND id NOT IN (SELECT content_item_id FROM generated_history WHERE content_item_id IS NOT NULL)`,
					)
					.run();
			}
			return changes;
		})();

		this.logger.log(
			`clear all stories: removed ${removed} (kept ${keptBookmarked} bookmarked, ${keptInCollections} in collections)`,
		);
		return {
			deleted: removed,
			keptBookmarked,
			keptInCollections,
			freedContentBytes: freed.b,
		};
	}

	// ── Internals ─────────────────────────────────────────────────────────────

	private async measureLibraries(): Promise<
		{ key: string; bytes: number; items?: number }[]
	> {
		const dataDir = resolveDataDir(this.env);

		// Database library = the SQLite file + its WAL/SHM siblings.
		const dbFile = resolveDbPath(this.env);
		const dbBytes = await sumFiles([dbFile, `${dbFile}-wal`, `${dbFile}-shm`]);

		const mediaBytes = await dirSize(resolveMediaDir(this.env));
		const mediaItems = this.count(
			`SELECT COUNT(*) AS c FROM article_media WHERE kept_at IS NOT NULL`,
		);

		const backupsBytes = await dirSize(resolveBackupDir(this.env));
		const backupsItems = await entryCount(resolveBackupDir(this.env));

		const pluginsBytes = await dirSize(resolvePluginsDir(this.env));
		const pluginsItems = await entryCount(resolvePluginsDir(this.env));

		const libraries = [
			{ key: "database", bytes: dbBytes },
			{ key: "media", bytes: mediaBytes, items: mediaItems },
			{ key: "backups", bytes: backupsBytes, items: backupsItems },
			{ key: "plugins", bytes: pluginsBytes, items: pluginsItems },
		];
		this.logger.debug(
			`data dir ${dataDir}: ${libraries
				.map((l) => `${l.key}=${l.bytes}`)
				.join(", ")}`,
		);
		return libraries;
	}

	private async measureStories(): Promise<{
		total: number;
		contentBytes: number;
	}> {
		const raw = this.db.rawDb;
		const total = this.count(`SELECT COUNT(*) AS c FROM articles`);
		const contentBytes = (
			raw
				.prepare(
					`SELECT COALESCE(SUM(LENGTH(content)) + SUM(LENGTH(COALESCE(title,'')))
						+ SUM(LENGTH(COALESCE(original_title,'')))
						+ SUM(LENGTH(COALESCE(translated_content,''))), 0) AS b
					 FROM articles`,
				)
				.get() as { b: number }
		).b;
		return { total, contentBytes };
	}

	private async measureProcess(sampleMs: number): Promise<{
		rssBytes: number;
		heapTotalBytes: number;
		heapUsedBytes: number;
		cpuPercent: number;
		uptimeSeconds: number;
		startedAt: string;
	}> {
		const mem = process.memoryUsage();
		const cpuStart = process.cpuUsage();
		const wallStart = Date.now();
		await new Promise((r) => setTimeout(r, sampleMs));
		const cpuDelta = process.cpuUsage(cpuStart);
		const wallMs = Date.now() - wallStart;

		// cpuUsage returns microseconds of user+system CPU time; divide by the
		// wall window in µs to get utilization as a percentage (may exceed 100
		// when the engine uses more than one core).
		const cpuPercent =
			Math.round(
				((cpuDelta.user + cpuDelta.system) / (wallMs * 1000)) * 100 * 10,
			) / 10;

		return {
			rssBytes: mem.rss,
			heapTotalBytes: mem.heapTotal,
			heapUsedBytes: mem.heapUsed,
			cpuPercent,
			uptimeSeconds: Math.round(process.uptime()),
			startedAt: this.startedAt.toISOString(),
		};
	}

	private measureSystem(): {
		totalMemBytes: number;
		freeMemBytes: number;
		cpuModel: string;
		cpuCores: number;
	} {
		const cpus = os.cpus();
		return {
			totalMemBytes: os.totalmem(),
			freeMemBytes: os.freemem(),
			cpuModel: cpus[0]?.model ?? "unknown",
			cpuCores: cpus.length,
		};
	}

	private count(sql: string): number {
		const row = this.db.rawDb.prepare(sql).get() as { c: number };
		return row.c;
	}
}

/** Sum of a list of files' sizes (missing files count as 0). */
async function sumFiles(paths: string[]): Promise<number> {
	let total = 0;
	for (const p of paths) {
		try {
			const st = await stat(p);
			if (st.isFile()) total += st.size;
		} catch {
			// WAL/SHM may not exist yet — 0 bytes is correct.
		}
	}
	return total;
}

/** Recursive size of a directory in bytes (missing/unreadable → 0). */
async function dirSize(dir: string): Promise<number> {
	let total = 0;
	try {
		const entries = await readdir(dir, {
			recursive: true,
			withFileTypes: true,
		});
		for (const entry of entries) {
			if (entry.isFile()) {
				const st = await stat(join(entry.parentPath, entry.name));
				if (st.isFile()) total += st.size;
			}
		}
	} catch {
		// Directory doesn't exist yet (e.g. no media kept) — 0 bytes.
	}
	return total;
}

/** Number of immediate entries in a directory (missing → 0). */
async function entryCount(dir: string): Promise<number> {
	try {
		const entries = await readdir(dir, { withFileTypes: true });
		return entries.length;
	} catch {
		return 0;
	}
}
