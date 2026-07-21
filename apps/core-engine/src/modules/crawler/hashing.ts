import { createHash } from "node:crypto";
import type { Article } from "@vorynth/types";

/**
 * Deterministic dedup hash for an article (project-details.md §21).
 *
 * Hashes the normalized title + ISO publishedAt (when present) + sourceId so
 * the same story seen twice from the same source collapses to one row.
 */
export function articleHash(input: {
	title: string;
	publishedAt?: Date | null;
	sourceId: string;
}): string {
	const norm = (input.title ?? "").trim().toLowerCase().replace(/\s+/g, " ");
	const when = input.publishedAt ? input.publishedAt.toISOString() : "unknown";
	const material = `${norm}|${when}|${input.sourceId}`;
	return createHash("sha256").update(material).digest("hex");
}

/** Picks the dedup hash material off an Article row. */
export function hashOfArticle(
	a: Pick<Article, "title" | "publishedAt" | "sourceId">,
): string {
	return articleHash({
		title: a.title,
		publishedAt: a.publishedAt,
		sourceId: a.sourceId,
	});
}
