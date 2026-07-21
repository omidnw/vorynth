import type { Article } from "@vorynth/types";

/**
 * Source adapter contract (project-details.md §28).
 *
 * Every source type — RSS, GitHub, Reddit, arXiv, sitemap, custom HTML —
 * implements this interface and is registered with the crawler. Adding a new
 * source must not require touching the core system (§27 plugin architecture).
 */
export interface SourceAdapter {
	/** Stable id, e.g. "rss", "github", "reddit". */
	readonly name: string;

	/** Cheap check that the source is reachable / configured correctly. */
	validate(config: Record<string, unknown>): Promise<boolean> | boolean;

	/** Pull raw items from the source. */
	fetch(config: Record<string, unknown>): Promise<RawFetchedItem[]>;

	/** Convert one raw item into the normalized Article shape. */
	parse(item: RawFetchedItem, ctx: ParseContext): Article;
}

export interface RawFetchedItem {
	title: string;
	content: string;
	url: string;
	author?: string;
	publishedAt?: Date;
	/** Any adapter-specific payload the parser needs. */
	raw?: unknown;
}

export interface ParseContext {
	sourceId: string;
	/** SHA-256 of the normalized dedup key. */
	hash: string;
}
