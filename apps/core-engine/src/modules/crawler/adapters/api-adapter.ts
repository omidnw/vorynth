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
 * Generic JSON API adapter (v1.8.0, project-details.md §29).
 *
 * `configuration`: `{ api: ApiSourceConfig }`.
 *
 * Fetches a JSON endpoint and maps each record onto an article using the
 * dotted field paths the user configures (title, content, url, date, author).
 * Optional headers let API-key'd endpoints work.
 */
@Injectable()
export class ApiAdapter implements SourceAdapter {
	readonly name = "api";
	private readonly logger = new Logger("ApiAdapter");

	validate(config: Record<string, unknown>): boolean {
		const api = config["api"] as Record<string, unknown> | undefined;
		return (
			typeof api?.apiUrl === "string" &&
			api.apiUrl.startsWith("http") &&
			typeof api?.titleField === "string"
		);
	}

	async fetch(config: Record<string, unknown>): Promise<RawFetchedItem[]> {
		const api = config["api"] as Record<string, unknown> | undefined;
		const url = String(api?.apiUrl ?? "");
		const titleField = String(api?.titleField ?? "title");
		if (!url) throw new Error("api: missing api.apiUrl");

		const headers: Record<string, string> = {};
		const rawHeaders = api?.headers;
		if (typeof rawHeaders === "object" && rawHeaders !== null) {
			for (const [k, v] of Object.entries(rawHeaders)) {
				if (typeof v === "string") headers[k] = v;
			}
		}

		const res = await fetch(url, {
			headers: {
				Accept: "application/json",
				"user-agent": "Mozilla/5.0 (compatible; Vorynth/1.0)",
				...headers,
			},
			signal: AbortSignal.timeout(20_000),
		});
		if (!res.ok) {
			this.logger.warn(`api: HTTP ${res.status} for ${url}`);
			return [];
		}
		const json: unknown = await res.json();

		const records = extractRecords(json, str(api?.itemsPath));
		const items: RawFetchedItem[] = [];
		for (const rec of records) {
			const title = pickString(rec, titleField);
			if (!title) continue;
			const urlField = str(api?.urlField);
			const itemUrl = urlField ? (pickString(rec, urlField) ?? url) : url;
			const dateField = str(api?.dateField);
			const dateStr = dateField ? pickString(rec, dateField) : undefined;
			const contentField = str(api?.contentField);
			const authorField = str(api?.authorField);
			items.push({
				title,
				content: contentField ? (pickString(rec, contentField) ?? "") : "",
				url: itemUrl,
				author: authorField ? pickString(rec, authorField) : undefined,
				publishedAt: dateStr ? new Date(dateStr) : undefined,
			});
		}

		this.logger.log(`api: ${items.length} items from ${url}`);
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

/** Navigate an object by a dotted path ("data.posts") or JSON pointer. */
function getPath(value: unknown, path: string): unknown {
	if (!path) return value;
	const parts = path.startsWith("/")
		? path.slice(1).split("/")
		: path.split(".");
	let cur: unknown = value;
	for (const part of parts) {
		if (cur === null || typeof cur !== "object") return undefined;
		cur = (cur as Record<string, unknown>)[part];
	}
	return cur;
}

/** Resolve the records array: an optional path, else the top-level array. */
function extractRecords(json: unknown, itemsPath?: string): unknown[] {
	const target = itemsPath ? getPath(json, itemsPath) : json;
	if (Array.isArray(target)) return target;
	if (target && typeof target === "object") {
		// Some APIs wrap the array in an object ("{ data: [...] }").
		for (const v of Object.values(target)) {
			if (Array.isArray(v)) return v;
		}
	}
	return [];
}

function pickString(rec: unknown, field: string): string | undefined {
	const v = getPath(rec, field);
	if (typeof v === "string") return v.trim();
	if (typeof v === "number") return String(v);
	return undefined;
}

function str(v: unknown): string | undefined {
	return typeof v === "string" && v.trim() ? v.trim() : undefined;
}
