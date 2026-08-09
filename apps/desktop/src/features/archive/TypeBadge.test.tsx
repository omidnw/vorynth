import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import "@/i18n"; // register the react-i18next instance (English catalog)
import type { ContentItemType } from "@vorynth/types";
import { TypeBadge } from "./TypeBadge.js";
import { BOOKMARK_META, TYPE_META, typeMetaLabel } from "./type-meta.js";

/**
 * Per-type identity (v1.7.0): every model type renders its own icon + label so
 * an archive row is recognizable at a glance. Asserted through the accessible
 * name (title + text) and the rendered Material Symbols glyph. Labels come
 * from the shared `types.*` translation keys.
 */
describe("TypeBadge", () => {
	it("renders the correct label + icon for every content type", () => {
		const cases: Array<[ContentItemType, string]> = [
			["article", "Story"],
			["summary", "Summary"],
			["keyword-search", "Search"],
			["ai-ask", "Ask AI"],
		];
		for (const [contentType, label] of cases) {
			const { container } = render(<TypeBadge contentType={contentType} />);
			// The type's accessible name (title) + visible label.
			const badge = container.querySelector(`[title="Type: ${label}"]`);
			expect(badge).not.toBeNull();
			expect(badge).toHaveTextContent(label);
			// The type's own Material Symbols glyph is rendered.
			expect(
				container.querySelector(`[data-icon="${TYPE_META[contentType].icon}"]`),
			).not.toBeNull();
		}
	});

	it("bookmark meta carries the bookmark icon", () => {
		expect(BOOKMARK_META.icon).toBe("bookmark");
	});

	it("typeMetaLabel maps every content type to its types.* key", () => {
		const keyT = ((key: string) => key) as Parameters<typeof typeMetaLabel>[0];
		expect(typeMetaLabel(keyT, "article")).toBe("types.article");
		expect(typeMetaLabel(keyT, "summary")).toBe("types.summary");
		expect(typeMetaLabel(keyT, "keyword-search")).toBe("types.keyword-search");
		expect(typeMetaLabel(keyT, "ai-ask")).toBe("types.ai-ask");
	});
});
