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
 * arXiv adapter (project-details.md §27).
 *
 * `configuration`: `{ query }` (e.g. "cat:cs.AI" or "ti:transformer"). Uses
 * arXiv's public Atom API at http://export.arxiv.org/api/query?search_query=…
 */
@Injectable()
export class ArxivAdapter implements SourceAdapter {
	readonly name = "arxiv";
	private readonly logger = new Logger("ArxivAdapter");

	validate(config: Record<string, unknown>): boolean {
		return typeof config["query"] === "string";
	}

	async fetch(config: Record<string, unknown>): Promise<RawFetchedItem[]> {
		const query = encodeURIComponent(String(config["query"] ?? ""));
		const url = `http://export.arxiv.org/api/query?search_query=${query}&max_results=30&sortBy=submittedDate&sortOrder=descending`;

		const res = await fetch(url, {
			headers: { Accept: "application/atom+xml" },
		});
		if (!res.ok) {
			this.logger.warn(`arxiv: HTTP ${res.status}`);
			return [];
		}
		const xml = await res.text();
		return parseArxivAtom(xml);
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

/** Parse arXiv's Atom feed (namespaced <a:entry>). */
function parseArxivAtom(xml: string): RawFetchedItem[] {
	const items: RawFetchedItem[] = [];
	// arXiv uses <entry> at the default namespace.
	const entryRegex = /<(?:a:)?entry>([\s\S]*?)<\/(?:a:)?entry>/g;
	let m: RegExpExecArray | null;
	while ((m = entryRegex.exec(xml)) !== null) {
		const block = m[1] ?? "";
		const title = textOf(block, "title").replace(/\s+/g, " ").trim();
		const summary = textOf(block, "summary");
		const published = textOf(block, "published");
		const id = textOf(block, "id");
		const author = textOf(block, "name");
		if (!title) continue;
		items.push({
			title,
			content: summary.replace(/\s+/g, " ").trim(),
			url: id,
			author: author || undefined,
			publishedAt: published ? new Date(published) : undefined,
		});
	}
	return items;
}

function textOf(block: string, tag: string): string {
	const re = new RegExp(
		`<(?:a:)?${tag}[^>]*>([\\s\\S]*?)</(?:a:)?${tag}>`,
		"i",
	);
	const m = re.exec(block);
	return m ? (m[1] ?? "").trim() : "";
}
