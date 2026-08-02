import type { ContentItemType } from "@vorynth/types";

/**
 * Per-type identity for archive items (v1.7.0) — every model type has its own
 * icon + label so a row is recognizable at a glance (Story / Summary / Search
 * / Ask AI). Bookmarks are a flag, not a type (R-A10), so the saved-state chip
 * gets its own icon entry here too.
 */
export const TYPE_META: Record<ContentItemType, { icon: string; label: string }> = {
	article: { icon: "article", label: "Story" },
	summary: { icon: "summarize", label: "Summary" },
	"keyword-search": { icon: "search", label: "Search" },
	"ai-ask": { icon: "auto_awesome", label: "Ask AI" },
};

/** Saved-state identity — the bookmark flag shown alongside an item. */
export const BOOKMARK_META = { icon: "bookmark", label: "Saved" };

/** Safe lookup for unknown/malformed content types. */
export function typeMeta(contentType: ContentItemType): { icon: string; label: string } {
	return TYPE_META[contentType] ?? { icon: "article", label: contentType };
}
