import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import Parser from "rss-parser";
import type { Article } from "@vorynth/types";
import type {
	ParseContext,
	RawFetchedItem,
	SourceAdapter,
} from "../source-adapter.js";
import { htmlToReadableText } from "./html-extract.js";
import { articleHash } from "../hashing.js";

/**
 * RSS source adapter (project-details.md §28).
 *
 * The first adapter implemented for the vertical slice. Uses `rss-parser` to
 * turn a feed URL into normalized Articles. New adapters (GitHub, arXiv, …)
 * follow the same shape and register in `CrawlerService`.
 */
@Injectable()
export class RssAdapter implements SourceAdapter {
	readonly name = "rss";
	private readonly logger = new Logger("RssAdapter");
	private readonly parser = new Parser<unknown, unknown>({
		timeout: 15_000,
		customFields: {},
	});

	validate(config: Record<string, unknown>): boolean {
		const feedUrl = config["feedUrl"];
		return typeof feedUrl === "string" && feedUrl.startsWith("http");
	}

	async fetch(config: Record<string, unknown>): Promise<RawFetchedItem[]> {
		const feedUrl = String(config["feedUrl"] ?? "");
		if (!feedUrl) throw new Error("rss: missing feedUrl in configuration");

		const feed = await this.parser.parseURL(feedUrl);
		const items: RawFetchedItem[] = [];

		for (const entry of feed.items ?? []) {
			const title = (entry.title ?? "").trim();
			if (!title) continue;
			items.push({
				title,
				// v1.8.0 readability: prefer the feed's HTML body (content:encoded)
				// and convert it with the same block/table-aware extraction the
				// page crawlers use — rss-parser's contentSnippet naively strips
				// tags, flattening tables into a wall of line-separated cells.
				// Fall back to the plain snippet/summary when no body exists.
				content: entry.content
					? htmlToReadableText(entry.content)
					: (entry.contentSnippet ?? entry.summary ?? ""),
				url: entry.link ?? "",
				author: toCreatorName(entry.creator),
				publishedAt: entry.isoDate
					? new Date(entry.isoDate)
					: entry.pubDate
						? new Date(entry.pubDate)
						: undefined,
				raw: entry,
			});
		}

		this.logger.log(`rss: fetched ${items.length} items from ${feedUrl}`);
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

/**
 * Coerce a feed's `<dc:creator>` value to a plain string author name.
 *
 * rss-parser hands most feeds back a string, but feeds that nest elements
 * inside `<dc:creator>` (e.g. blog.google's structured author block) come back
 * as an object like `{ name: ["News from Google Team"], title: [""], ... }`.
 * The Article type says author is `string | null` — an object must never reach
 * the DB write path (better-sqlite3 rejects it and the whole source collect
 * rolls back), so extract the name from whatever shape we get (R-A06).
 */
export function toCreatorName(creator: unknown): string | undefined {
	if (typeof creator === "string") {
		const t = creator.trim();
		return t || undefined;
	}
	if (Array.isArray(creator)) {
		const t = creator
			.map((c) => toCreatorName(c))
			.filter((c): c is string => Boolean(c))
			.join(", ");
		return t || undefined;
	}
	if (creator && typeof creator === "object") {
		const name = (creator as Record<string, unknown>)["name"];
		return toCreatorName(Array.isArray(name) ? name[0] : name);
	}
	return undefined;
}
