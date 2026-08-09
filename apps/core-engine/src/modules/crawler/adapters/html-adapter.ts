import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import * as cheerio from "cheerio";
import type { Article } from "@vorynth/types";
import type {
	ParseContext,
	RawFetchedItem,
	SourceAdapter,
} from "../source-adapter.js";
import { articleHash } from "../hashing.js";
import { extractArticle, fetchPage, resolveUrl } from "./html-extract.js";

/**
 * Custom HTML crawler adapter (project-details.md §30, v1.8.0).
 *
 * `configuration`: `{ crawl: HtmlCrawlConfig }`.
 *
 * Two modes:
 * - **Item-list mode** (`itemSelector` set): fetch the listing page, find each
 *   article container, resolve its link, then fetch each article page and
 *   extract title/content/date/author.
 * - **Single-page mode** (no `itemSelector`): the URL itself is an article.
 */
@Injectable()
export class HtmlAdapter implements SourceAdapter {
	readonly name = "html";
	private readonly logger = new Logger("HtmlAdapter");

	validate(config: Record<string, unknown>): boolean {
		const crawl = config["crawl"] as Record<string, unknown> | undefined;
		return typeof crawl?.url === "string" && crawl.url.startsWith("http");
	}

	async fetch(config: Record<string, unknown>): Promise<RawFetchedItem[]> {
		const crawl = config["crawl"] as Record<string, unknown> | undefined;
		const url = String(crawl?.url ?? "");
		if (!url) throw new Error("html: missing crawl.url in configuration");

		const itemSelector = str(crawl?.itemSelector);
		const maxItems = clampInt(crawl?.maxItems, 1, 25, 10);

		// Single-page mode: the URL is the article.
		if (!itemSelector) {
			const html = await fetchPage(url);
			if (!html) return [];
			const page = extractArticle(html, url, selectorsOf(crawl));
			if (!page.title) return [];
			this.logger.log(`html: extracted 1 article from ${url}`);
			return [toRawItem(page)];
		}

		// Item-list mode.
		const listHtml = await fetchPage(url);
		if (!listHtml) return [];
		const $ = cheerio.load(listHtml);
		const linkSelector = str(crawl?.linkSelector) ?? "a[href]";
		const titleSelector = str(crawl?.titleSelector);

		const links: { href: string; label: string }[] = [];
		$(itemSelector).each((_, el) => {
			const link = $(el).find(linkSelector).first();
			const href = link.attr("href");
			if (!href) return;
			const label = titleSelector
				? $(el).find(titleSelector).first().text().trim() ||
					$(el).find("a").first().text().trim()
				: link.text().trim();
			links.push({ href: resolveUrl(href, url), label: normalizeWs(label) });
		});

		// Cap the number of article pages fetched per run.
		const chosen = links.slice(0, maxItems);
		const items: RawFetchedItem[] = [];
		for (const { href, label } of chosen) {
			const html = await fetchPage(href);
			if (!html) continue;
			const page = extractArticle(html, href, selectorsOf(crawl));
			if (!page.title && !label) continue;
			items.push(toRawItem({ ...page, title: page.title || label }));
		}

		this.logger.log(
			`html: ${chosen.length} links found, ${items.length} articles extracted from ${url}`,
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

/** Flatten the nested `crawl` config into flat selectors for extraction. */
function selectorsOf(crawl: Record<string, unknown> | undefined) {
	return {
		titleSelector: str(crawl?.titleSelector),
		contentSelector: str(crawl?.contentSelector),
		dateSelector: str(crawl?.dateSelector),
		authorSelector: str(crawl?.authorSelector),
	};
}

function toRawItem(page: {
	title: string;
	content: string;
	url: string;
	author?: string;
	publishedAt?: Date;
}): RawFetchedItem {
	return {
		title: page.title,
		content: page.content,
		url: page.url,
		author: page.author,
		publishedAt: page.publishedAt,
	};
}

function str(v: unknown): string | undefined {
	return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function clampInt(v: unknown, min: number, max: number, dflt: number): number {
	const n =
		typeof v === "number" ? Math.floor(v) : Number.parseInt(String(v), 10);
	if (Number.isNaN(n)) return dflt;
	return Math.min(max, Math.max(min, n));
}

function normalizeWs(s: string): string {
	return s.replace(/\s+/g, " ").trim();
}
