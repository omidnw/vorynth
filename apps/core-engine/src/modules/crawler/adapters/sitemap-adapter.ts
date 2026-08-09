import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Article } from "@vorynth/types";
import type {
	ParseContext,
	RawFetchedItem,
	SourceAdapter,
} from "../source-adapter.js";
import { articleHash } from "../hashing.js";
import { extractArticle, fetchPage } from "./html-extract.js";

/**
 * Sitemap adapter (v1.8.0, project-details.md §29).
 *
 * `configuration`: `{ sitemap: SitemapSourceConfig }`.
 *
 * Reads the URL list from an XML sitemap (or sitemap index), then fetches each
 * listed page and extracts it with the same selector extraction as the HTML
 * adapter. Pages are capped per run to keep collection bounded.
 */
@Injectable()
export class SitemapAdapter implements SourceAdapter {
	readonly name = "sitemap";
	private readonly logger = new Logger("SitemapAdapter");

	validate(config: Record<string, unknown>): boolean {
		const sitemap = config["sitemap"] as Record<string, unknown> | undefined;
		return (
			typeof sitemap?.sitemapUrl === "string" &&
			sitemap.sitemapUrl.startsWith("http")
		);
	}

	async fetch(config: Record<string, unknown>): Promise<RawFetchedItem[]> {
		const sitemap = config["sitemap"] as Record<string, unknown> | undefined;
		const url = String(sitemap?.sitemapUrl ?? "");
		if (!url) throw new Error("sitemap: missing sitemap.sitemapUrl");

		const xml = await fetchPage(url);
		if (!xml) return [];
		const locs = parseLocs(xml);

		// Cap article fetches per run; sitemaps can list thousands of URLs.
		const pages = locs.slice(0, 25);
		const items: RawFetchedItem[] = [];
		for (const loc of pages) {
			const html = await fetchPage(loc);
			if (!html) continue;
			const page = extractArticle(html, loc, {
				titleSelector: str(sitemap?.titleSelector),
				contentSelector: str(sitemap?.contentSelector),
			});
			if (!page.title) continue;
			items.push({
				title: page.title,
				content: page.content,
				url: loc,
				author: page.author,
				publishedAt: page.publishedAt,
			});
		}

		this.logger.log(
			`sitemap: ${locs.length} URLs in ${url}, ${items.length} articles`,
		);
		return items;
	}

	parse(item: RawFetchedItem, ctx: ParseContext): Article {
		const publishedAt = item.publishedAt ?? null;
		return {
			id: randomUUID(),
			sourceId: ctx.sourceId,
			title: item.title,
			content: item.content,
			url: item.url,
			author: item.author ?? null,
			publishedAt,
			collectedAt: new Date(),
			hash: articleHash({
				title: item.title,
				publishedAt,
				sourceId: ctx.sourceId,
			}),
		};
	}
}

/** Extract all `<loc>` URLs from a sitemap (or sitemap index) XML body. */
function parseLocs(xml: string): string[] {
	const out: string[] = [];
	const re = /<loc[^>]*>([\s\S]*?)<\/loc>/gi;
	let m: RegExpExecArray | null;
	while ((m = re.exec(xml)) !== null) {
		const loc = (m[1] ?? "").trim();
		if (loc && loc.startsWith("http")) out.push(loc);
	}
	return out;
}

function str(v: unknown): string | undefined {
	return typeof v === "string" && v.trim() ? v.trim() : undefined;
}
