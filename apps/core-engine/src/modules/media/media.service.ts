import { Inject, Injectable, Logger } from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { DatabaseService } from "../../db/database.service.js";
import { articles, articleMedia, sources } from "../../db/schema.js";
import { resolveArticleMediaDir, resolveMediaDir } from "../../db/paths.js";
import type {
	ArticleMedia,
	LocalMediaArticle,
	LocalMediaSummary,
	MediaKind,
	SetMediaKeepAllInput,
	SetMediaKeepInput,
} from "@vorynth/types";

/**
 * Article media extraction + local-storage control (v1.1.0).
 *
 * Vorynth never stores media by default. When the reader page asks for an
 * article's media, this service fetches the original HTML once (cached in
 * memory for the process lifetime), extracts image/video URLs, and returns
 * them flagged `source: "remote"` — the client renders them straight from the
 * source URL. The user can then opt to "keep" any item locally: the engine
 * downloads the bytes to `<dataDir>/vorynth-media/<articleId>/<hash>.<ext>`,
 * records the path + size, and subsequent reads serve `source: "local"`.
 *
 * This is the explicit per-item, per-article decision surface the user asked
 * for — nothing is kept without consent, and the Media page enumerates exactly
 * what's on disk and how much space it uses.
 */
@Injectable()
export class MediaService {
	private readonly logger = new Logger("Media");
	/** Article HTML cache: articleId → html (process-lifetime). */
	private readonly htmlCache = new Map<string, string>();
	/** Extracted media cache: articleId → raw items (process-lifetime). */
	private readonly mediaCache = new Map<
		string,
		{ url: string; kind: MediaKind; caption: string | null }[]
	>();

	constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

	// ── List media for one article ───────────────────────────────────────────

	/**
	 * Return all known media for an article. If we've never extracted before,
	 * fetch + parse the source HTML and persist one `article_media` row per
	 * found URL (with `local_path`/`bytes` NULL — remote until kept). Items the
	 * user has already kept locally are returned with `source: "local"`.
	 */
	async listForArticle(articleId: string): Promise<ArticleMedia[]> {
		const article = await this.db.db
			.select()
			.from(articles)
			.where(eq(articles.id, articleId))
			.get();
		if (!article) return [];

		// First time? Extract + seed rows.
		let rows = await this.db.db
			.select()
			.from(articleMedia)
			.where(eq(articleMedia.articleId, articleId))
			.all();
		if (rows.length === 0) {
			const extracted = await this.extractFromSource(article.url);
			if (extracted.length > 0) {
				await this.seedRows(articleId, extracted);
				rows = await this.db.db
					.select()
					.from(articleMedia)
					.where(eq(articleMedia.articleId, articleId))
					.all();
			}
		}

		return rows.map((r) => this.toDto(r));
	}

	// ── Keep / release ───────────────────────────────────────────────────────

	/** Toggle "keep locally" for one media item (matched by url within article). */
	async setKeep(
		articleId: string,
		input: SetMediaKeepInput,
	): Promise<ArticleMedia | null> {
		const row = await this.db.db
			.select()
			.from(articleMedia)
			.where(eq(articleMedia.articleId, articleId))
			.all()
			.find((r) => r.url === input.url);
		if (!row) return null;

		if (input.keep) {
			await this.downloadToLocal(articleId, row.url, row.mime, row.id);
		} else {
			await this.releaseLocal(row.id, row.localPath);
		}
		const updated = await this.db.db
			.select()
			.from(articleMedia)
			.where(eq(articleMedia.id, row.id))
			.get();
		return updated ? this.toDto(updated) : null;
	}

	/** Bulk keep/release every media item for an article. */
	async setKeepAll(
		articleId: string,
		input: SetMediaKeepAllInput,
	): Promise<ArticleMedia[]> {
		const rows = await this.db.db
			.select()
			.from(articleMedia)
			.where(eq(articleMedia.articleId, articleId))
			.all();
		for (const row of rows) {
			const alreadyKept = row.localPath !== null;
			if (input.keep && !alreadyKept) {
				await this.downloadToLocal(articleId, row.url, row.mime, row.id);
			} else if (!input.keep && alreadyKept) {
				await this.releaseLocal(row.id, row.localPath);
			}
		}
		const fresh = await this.db.db
			.select()
			.from(articleMedia)
			.where(eq(articleMedia.articleId, articleId))
			.all();
		return fresh.map((r) => this.toDto(r));
	}

	// ── Storage dashboard ────────────────────────────────────────────────────

	/** Aggregate view of all locally-kept media, for the Media management page. */
	async localSummary(): Promise<LocalMediaSummary> {
		// All media rows joined with article + source metadata. Filter to kept
		// rows in JS — keptAt is null until the user opts in, and we need the
		// full row set grouped per article.
		const rows = await this.db.db
			.select({
				articleId: articleMedia.articleId,
				bytes: articleMedia.bytes,
				keptAt: articleMedia.keptAt,
				title: articles.title,
				collectedAt: articles.collectedAt,
				sourceName: sources.name,
			})
			.from(articleMedia)
			.innerJoin(articles, eq(articles.id, articleMedia.articleId))
			.leftJoin(sources, eq(sources.id, articles.sourceId))
			.all();

		const kept = rows.filter((r) => r.keptAt !== null);

		const byArticle = new Map<string, { bytes: number; items: number }>();
		for (const r of kept) {
			const cur = byArticle.get(r.articleId) ?? { bytes: 0, items: 0 };
			cur.bytes += r.bytes ?? 0;
			cur.items += 1;
			byArticle.set(r.articleId, cur);
		}

		const articleRows: LocalMediaArticle[] = [];
		for (const [articleId, agg] of byArticle) {
			const m = kept.find((r) => r.articleId === articleId);
			articleRows.push({
				articleId,
				articleTitle: m?.title ?? "Unknown",
				sourceName: m?.sourceName ?? null,
				collectedAt: m
					? new Date(m.collectedAt).toISOString()
					: new Date(0).toISOString(),
				itemCount: agg.items,
				bytes: agg.bytes,
			});
		}
		articleRows.sort((a, b) => b.bytes - a.bytes);

		const totalBytes = articleRows.reduce((s, a) => s + a.bytes, 0);
		const totalItems = articleRows.reduce((s, a) => s + a.itemCount, 0);
		return {
			articles: articleRows,
			totalBytes,
			totalItems,
		};
	}

	/** Release every locally-kept media item for an article. */
	async releaseArticle(articleId: string): Promise<number> {
		const rows = await this.db.db
			.select()
			.from(articleMedia)
			.where(eq(articleMedia.articleId, articleId))
			.all();
		let n = 0;
		for (const row of rows) {
			if (row.localPath) {
				await this.releaseLocal(row.id, row.localPath);
				n += 1;
			}
		}
		return n;
	}

	/** Delete every locally-kept media blob on disk + clear the rows' local fields. */
	async purgeAll(): Promise<number> {
		const mediaDir = resolveMediaDir();
		try {
			await rm(mediaDir, { recursive: true, force: true });
			await mkdir(mediaDir, { recursive: true });
		} catch (err) {
			this.logger.warn(`purgeAll fs step failed: ${(err as Error).message}`);
		}
		const rows = await this.db.db.select().from(articleMedia).all();
		let n = 0;
		for (const row of rows) {
			if (row.localPath) {
				await this.db.db
					.update(articleMedia)
					.set({
						localPath: null,
						bytes: null,
						keptAt: null,
						updatedAt: new Date(),
					})
					.where(eq(articleMedia.id, row.id))
					.run();
				n += 1;
			}
		}
		return n;
	}

	// ── Internals: fetch + extract ───────────────────────────────────────────

	/**
	 * Fetch the article's source HTML once (cached), then pull out image and
	 * video URLs with a lightweight tag scan. No DOM library — we only need
	 * URLs + alt/caption, not readable article text (that's already stored).
	 * Relative URLs are resolved against the article's origin.
	 */
	private async extractFromSource(
		articleUrl: string,
	): Promise<{ url: string; kind: MediaKind; caption: string | null }[]> {
		if (!articleUrl) return [];
		const html = await this.fetchHtml(articleUrl);
		if (!html) return [];

		const baseUrl = this.originOf(articleUrl);
		const imgs = this.scanTags(html, "img", ["src", "data-src"], baseUrl);
		const vids = this.scanTags(
			html,
			videoSourceRegExp(),
			["src"],
			baseUrl,
			"video",
		);
		const sources = this.scanTags(html, "source", ["src"], baseUrl);

		const seen = new Set<string>();
		const out: { url: string; kind: MediaKind; caption: string | null }[] = [];
		// Videos first (higher signal), then sources, then images.
		for (const v of [...vids, ...sources, ...imgs]) {
			if (v.url && !seen.has(v.url) && !this.isJunk(v.url)) {
				seen.add(v.url);
				out.push({ url: v.url, kind: v.kind, caption: v.caption });
			}
		}
		// Cap to keep payloads sane.
		return out.slice(0, 40);
	}

	private async fetchHtml(url: string): Promise<string | null> {
		const cached = this.htmlCache.get(url);
		if (cached !== undefined) return cached;
		try {
			const res = await fetch(url, {
				headers: {
					"user-agent":
						"Mozilla/5.0 (compatible; Vorynth/1.0; +https://vorynth.local)",
				},
				redirect: "follow",
				signal: AbortSignal.timeout(15_000),
			});
			if (!res.ok) {
				this.logger.warn(`fetchHtml ${url} → ${res.status}`);
				this.htmlCache.set(url, "");
				return "";
			}
			const text = await res.text();
			this.htmlCache.set(url, text);
			return text;
		} catch (err) {
			this.logger.warn(
				`fetchHtml failed for ${url}: ${(err as Error).message}`,
			);
			this.htmlCache.set(url, "");
			return "";
		}
	}

	/**
	 * Scan the HTML for opening tags of one element and pull attributes.
	 * `element` may be a tag name ("img", "source") or a RegExp (for video).
	 * Returns absolute URLs + an optional caption (alt for images).
	 */
	private scanTags(
		html: string,
		element: string | RegExp,
		urlAttrs: string[],
		baseUrl: string,
		kindOverride?: MediaKind,
	): { url: string; kind: MediaKind; caption: string | null }[] {
		const tagRe =
			typeof element === "string"
				? new RegExp(`<${element}\\b[^>]*>`, "gi")
				: element;
		const out: { url: string; kind: MediaKind; caption: string | null }[] = [];
		let m: RegExpExecArray | null;
		while ((m = tagRe.exec(html)) !== null) {
			const tag = m[0];
			const url = this.firstAttr(tag, urlAttrs);
			if (!url) continue;
			const absolute = this.resolveUrl(url, baseUrl);
			if (!absolute) continue;
			const kind: MediaKind =
				kindOverride ?? (this.looksLikeVideo(absolute) ? "video" : "image");
			const alt = this.attr(tag, "alt") ?? this.attr(tag, "title");
			out.push({ url: absolute, kind, caption: alt });
		}
		return out;
	}

	private firstAttr(tag: string, names: string[]): string | null {
		for (const n of names) {
			const v = this.attr(tag, n);
			if (v) return v;
		}
		return null;
	}

	private attr(tag: string, name: string): string | null {
		const re = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i");
		const m = re.exec(tag);
		if (!m) return null;
		return m[2] ?? m[3] ?? null;
	}
	// (m[2]/m[3] are the two capture alternatives; both can be undefined under
	// noUncheckedIndexedAccess, but `?? null` already covers that.)

	private resolveUrl(raw: string, baseUrl: string): string | null {
		try {
			if (raw.startsWith("data:")) return null; // never inline data URIs
			return new URL(raw, baseUrl).toString();
		} catch {
			return null;
		}
	}

	private originOf(url: string): string {
		try {
			const u = new URL(url);
			return `${u.protocol}//${u.host}`;
		} catch {
			return url;
		}
	}

	private looksLikeVideo(url: string): boolean {
		return /\.(mp4|webm|ogv|mov|m3u8)(\?|#|$)/i.test(url);
	}

	private isJunk(url: string): boolean {
		const u = url.toLowerCase();
		return (
			u.includes("data:image/svg") ||
			u.includes("gravatar.com/avatar") ||
			u.includes("favicon") ||
			u.endsWith(".svg") ||
			u.includes("1x1") ||
			/pixel[\W\w]*\.gif/.test(u)
		);
	}

	// ── Internals: persistence ───────────────────────────────────────────────

	private async seedRows(
		articleId: string,
		items: { url: string; kind: MediaKind; caption: string | null }[],
	): Promise<void> {
		const now = new Date();
		const values = items.map((it) => ({
			id: randomUUID(),
			articleId,
			url: it.url,
			kind: it.kind,
			localPath: null,
			bytes: null,
			mime: this.guessMime(it.url),
			caption: it.caption,
			keptAt: null,
			fetchedAt: now,
			updatedAt: now,
		}));
		try {
			await this.db.db.insert(articleMedia).values(values).run();
		} catch (err) {
			this.logger.warn(`seedRows failed: ${(err as Error).message}`);
		}
	}

	private async downloadToLocal(
		articleId: string,
		url: string,
		mime: string | null,
		rowId: string,
	): Promise<void> {
		try {
			const res = await fetch(url, {
				headers: {
					"user-agent":
						"Mozilla/5.0 (compatible; Vorynth/1.0; +https://vorynth.local)",
				},
				redirect: "follow",
				signal: AbortSignal.timeout(30_000),
			});
			if (!res.ok) {
				throw new Error(`status ${res.status}`);
			}
			const buf = Buffer.from(await res.arrayBuffer());
			const detectedMime = mime ?? res.headers.get("content-type") ?? null;
			const ext = this.extFor(url, detectedMime);
			const hash = createHash("sha256").update(buf).digest("hex").slice(0, 16);
			const dir = resolveArticleMediaDir(articleId);
			await mkdir(dir, { recursive: true });
			const fileName = `${hash}.${ext}`;
			const fullPath = join(dir, fileName);
			await writeFile(fullPath, buf);
			const bytes = (await stat(fullPath)).size;
			await this.db.db
				.update(articleMedia)
				.set({
					localPath: fullPath,
					bytes,
					mime: detectedMime,
					keptAt: new Date(),
					updatedAt: new Date(),
				})
				.where(eq(articleMedia.id, rowId))
				.run();
		} catch (err) {
			this.logger.warn(
				`downloadToLocal failed for ${url}: ${(err as Error).message}`,
			);
		}
	}

	private async releaseLocal(
		rowId: string,
		localPath: string | null,
	): Promise<void> {
		if (localPath) {
			try {
				await rm(localPath, { force: true });
			} catch (err) {
				this.logger.warn(
					`releaseLocal fs step failed: ${(err as Error).message}`,
				);
			}
		}
		await this.db.db
			.update(articleMedia)
			.set({
				localPath: null,
				bytes: null,
				keptAt: null,
				updatedAt: new Date(),
			})
			.where(eq(articleMedia.id, rowId))
			.run();
	}

	private guessMime(url: string): string | null {
		const m = url.match(/\.(jpg|jpeg|png|gif|webp|avif|mp4|webm|mov)(\?|#|$)/i);
		const ext = m?.[1]?.toLowerCase();
		if (!ext) return null;
		const map: Record<string, string> = {
			jpg: "image/jpeg",
			jpeg: "image/jpeg",
			png: "image/png",
			gif: "image/gif",
			webp: "image/webp",
			avif: "image/avif",
			mp4: "video/mp4",
			webm: "video/webm",
			mov: "video/quicktime",
		};
		return map[ext] ?? null;
	}

	private extFor(url: string, mime: string | null): string {
		const m = url.match(/\.([a-z0-9]{2,4})(\?|#|$)/i);
		const ext = m?.[1]?.toLowerCase();
		if (ext) return ext;
		if (mime) {
			const sub = mime.split("/")[1];
			if (sub) return sub.split(";")[0] || "bin";
		}
		return "bin";
	}

	private toDto(row: {
		id: string;
		articleId: string;
		url: string;
		kind: MediaKind;
		localPath: string | null;
		bytes: number | null;
		mime: string | null;
		caption: string | null;
		keptAt: Date | null;
		fetchedAt: Date;
	}): ArticleMedia {
		return {
			id: row.id,
			articleId: row.articleId,
			url: row.url,
			kind: row.kind,
			source: row.localPath ? "local" : "remote",
			localPath: row.localPath,
			bytes: row.bytes,
			mime: row.mime,
			caption: row.caption,
			keptAt: row.keptAt,
			fetchedAt: row.fetchedAt,
		};
	}
}

/** `<video ...>` opening tag matcher (the tag name itself isn't a fixed string
 * we want to pass to scanTags as a plain name because of attribute parsing, so
 * we hand back a RegExp and route it through with kindOverride="video"). */
function videoSourceRegExp(): RegExp {
	return /<video\b[^>]*>/gi;
}
