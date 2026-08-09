import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Article } from "@vorynth/types";
import type {
	ParseContext,
	RawFetchedItem,
	SourceAdapter,
} from "../source-adapter.js";
import { articleHash } from "../hashing.js";

/**
 * Reddit adapter (v1.8.0, project-details.md §28 — the Reddit source type has
 * existed in the enum since day one; this registers the adapter for it).
 *
 * `configuration`: `{ reddit: RedditSourceConfig }` — a subreddit name.
 *
 * Pulls the subreddit's newest posts from Reddit's public JSON listing. The
 * User-Agent header is required by Reddit's API policy — always sent.
 */
@Injectable()
export class RedditAdapter implements SourceAdapter {
	readonly name = "reddit";
	private readonly logger = new Logger("RedditAdapter");

	validate(config: Record<string, unknown>): boolean {
		const reddit = config["reddit"] as Record<string, unknown> | undefined;
		return (
			typeof reddit?.subreddit === "string" &&
			reddit.subreddit.trim().length > 0
		);
	}

	async fetch(config: Record<string, unknown>): Promise<RawFetchedItem[]> {
		const reddit = config["reddit"] as Record<string, unknown> | undefined;
		const sub = String(reddit?.subreddit ?? "").trim();
		if (!sub) throw new Error("reddit: missing reddit.subreddit");

		const url = `https://www.reddit.com/r/${encodeURIComponent(sub)}/new.json?limit=25`;
		const res = await fetch(url, {
			headers: {
				Accept: "application/json",
				"user-agent": "Vorynth/1.0 (local-first intelligence engine)",
			},
			signal: AbortSignal.timeout(20_000),
		});
		if (!res.ok) {
			this.logger.warn(`reddit: HTTP ${res.status} for r/${sub}`);
			return [];
		}
		const json: unknown = await res.json();

		const children = getPath(json, "data.children");
		const items: RawFetchedItem[] = [];
		if (Array.isArray(children)) {
			for (const child of children) {
				const post = (child as Record<string, unknown>)?.["data"] as
					Record<string, unknown> | undefined;
				if (!post) continue;
				const title =
					typeof post["title"] === "string" ? post["title"].trim() : "";
				if (!title) continue;
				const permalink =
					typeof post["permalink"] === "string" ? post["permalink"] : "";
				const createdUtc = post["created_utc"];
				items.push({
					title,
					content:
						typeof post["selftext"] === "string"
							? post["selftext"].slice(0, 50_000)
							: "",
					url: permalink ? `https://www.reddit.com${permalink}` : url,
					author:
						typeof post["author"] === "string" ? post["author"] : undefined,
					publishedAt:
						typeof createdUtc === "number"
							? new Date(createdUtc * 1000)
							: undefined,
				});
			}
		}

		this.logger.log(`reddit: ${items.length} posts from r/${sub}`);
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

function getPath(value: unknown, path: string): unknown {
	const parts = path.split(".");
	let cur: unknown = value;
	for (const part of parts) {
		if (cur === null || typeof cur !== "object") return undefined;
		cur = (cur as Record<string, unknown>)[part];
	}
	return cur;
}
