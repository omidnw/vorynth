import type { ArchiveItem } from "@vorynth/types";

/**
 * Route to the full detail page for an archive item — the origin payload
 * decides which reader opens:
 *   • article        → article reader
 *   • keyword-search / ai-ask → cached search result
 *   • summary        → period briefing (has `period`) or generated result
 *
 * Shared by Archive, Bookmarks, and the collections tree so every entry point
 * opens the same detail page (v1.7.0).
 */
export function detailPath(item: ArchiveItem): string {
	const origin = item.origin as { id?: string; period?: string } | null;
	if (!origin?.id) return "/archive";
	switch (item.contentType) {
		case "article":
			return `/articles/${origin.id}`;
		case "keyword-search":
		case "ai-ask":
			return `/history/search/${origin.id}`;
		case "summary":
			return "period" in origin
				? `/history/brief/${origin.id}`
				: `/history/generated/${origin.id}`;
		default:
			return "/archive";
	}
}
