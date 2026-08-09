import type { ContentItemType } from "@vorynth/types";

/** Minimal `t` shape — matches how react-i18next's `t` is threaded in callers. */
export type TranslateFn = (
	key: string,
	options?: Record<string, unknown>,
) => string;

/**
 * Per-type identity for archive items (v1.7.0) — every model type has its own
 * icon + label so a row is recognizable at a glance (Story / Summary / Search
 * / Ask AI). Bookmarks are a flag, not a type (R-A10), so the saved-state chip
 * gets its own icon entry here too.
 *
 * Labels are translated: pass `t` to `typeMetaLabel` (the shared `types.*`
 * keys — `types.article`, `types.summary`, `types.keyword-search`,
 * `types.ai-ask`, and `types.saved` for the bookmark chip).
 */
export const TYPE_META: Record<ContentItemType, { icon: string }> = {
	article: { icon: "article" },
	summary: { icon: "summarize" },
	"keyword-search": { icon: "search" },
	"ai-ask": { icon: "auto_awesome" },
};

/** Saved-state identity — the bookmark flag shown alongside an item. */
export const BOOKMARK_META = { icon: "bookmark" };

/** Safe lookup for unknown/malformed content types (icon only). */
export function typeMeta(contentType: ContentItemType): { icon: string } {
	return TYPE_META[contentType] ?? { icon: "article" };
}

/** Translated label for a content type — the shared `types.*` keys. */
export function typeMetaLabel(
	t: TranslateFn,
	contentType: ContentItemType,
): string {
	switch (contentType) {
		case "article":
			return t("types.article");
		case "summary":
			return t("types.summary");
		case "keyword-search":
			return t("types.keyword-search");
		case "ai-ask":
			return t("types.ai-ask");
		default:
			return contentType;
	}
}
