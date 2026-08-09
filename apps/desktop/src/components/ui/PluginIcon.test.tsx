import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PluginIcon } from "@/components/ui/PluginIcon.js";

/**
 * PluginIcon resolver (v1.8.0): a connector renders its custom image
 * (`iconSrc`) when present, else the Icon Pack ligature (`icon`), else a
 * generic extension glyph. Both branches are decorative (aria-hidden).
 */
describe("PluginIcon — connector icon resolver (v1.8.0)", () => {
	it("renders a custom image when iconSrc is set", () => {
		const { container } = render(
			<PluginIcon icon="science" iconSrc="/plugins/arxiv/icon.svg" />,
		);
		const img = container.querySelector("img");
		expect(img?.getAttribute("src")).toBe("/plugins/arxiv/icon.svg");
		expect(img?.getAttribute("aria-hidden")).toBe("true");
	});

	it("renders the ligature glyph when only icon is set", () => {
		render(<PluginIcon icon="rss_feed" />);
		const glyph = document.querySelector("[data-icon='rss_feed']");
		expect(glyph).not.toBeNull();
	});

	it("falls back to the extension glyph when neither is set", () => {
		render(<PluginIcon />);
		expect(screen.getByText("extension")).toBeInTheDocument();
	});
});
