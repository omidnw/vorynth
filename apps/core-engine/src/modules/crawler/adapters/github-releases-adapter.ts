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
 * GitHub releases adapter (project-details.md §27).
 *
 * `configuration`: `{ owner, repo }`. Pulls the latest releases from
 * `https://github.com/{owner}/{repo}/releases.atom` (GitHub publishes an Atom
 * feed for every repo's releases, no token required for public repos).
 */
@Injectable()
export class GithubReleasesAdapter implements SourceAdapter {
	readonly name = "github-releases";
	private readonly logger = new Logger("GithubReleasesAdapter");

	validate(config: Record<string, unknown>): boolean {
		const owner = config["owner"];
		const repo = config["repo"];
		return typeof owner === "string" && typeof repo === "string";
	}

	async fetch(config: Record<string, unknown>): Promise<RawFetchedItem[]> {
		const owner = String(config["owner"] ?? "");
		const repo = String(config["repo"] ?? "");
		const url = `https://github.com/${owner}/${repo}/releases.atom`;

		const res = await fetch(url, {
			headers: { Accept: "application/atom+xml" },
		});
		if (!res.ok) {
			this.logger.warn(
				`github-releases: ${owner}/${repo} → HTTP ${res.status}`,
			);
			return [];
		}
		const xml = await res.text();
		return parseAtom(xml);
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

/** Minimal Atom <entry> parser — avoids a full XML dependency for this slice. */
function parseAtom(xml: string): RawFetchedItem[] {
	const items: RawFetchedItem[] = [];
	const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
	let m: RegExpExecArray | null;
	while ((m = entryRegex.exec(xml)) !== null) {
		const block = m[1] ?? "";
		const title = textOf(block, "title");
		const id = textOf(block, "id");
		const summary = textOf(block, "summary") || textOf(block, "content");
		const updated = textOf(block, "updated");
		if (!title) continue;
		items.push({
			title,
			content: stripTags(summary),
			url: id,
			publishedAt: updated ? new Date(updated) : undefined,
		});
	}
	return items;
}

function textOf(block: string, tag: string): string {
	const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
	const m = re.exec(block);
	return m ? (m[1] ?? "").trim() : "";
}

function stripTags(s: string): string {
	return s.replace(/<[^>]+>/g, "").trim();
}
