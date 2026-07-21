import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import Parser from "rss-parser";
import type { Article } from "@vorynth/types";
import type {
	ParseContext,
	RawFetchedItem,
	SourceAdapter,
} from "../source-adapter.js";
import { articleHash } from "../hashing.js";

/**
 * RSS source adapter (project-details.md §28).
 *
 * The first adapter implemented for the vertical slice. Uses `rss-parser` to
 * turn a feed URL into normalized Articles. New adapters (GitHub, Reddit,
 * arXiv, …) follow the same shape and register in `CrawlerService`.
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
				content: entry.contentSnippet ?? entry.content ?? entry.summary ?? "",
				url: entry.link ?? "",
				author: entry.creator ?? undefined,
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
