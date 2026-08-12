import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TopicPage } from "./TopicPage";

describe("TopicPage", () => {
	it("renders the ai-news-reader page with its keyword h1 and real content", () => {
		render(<TopicPage slug="ai-news-reader" />);

		expect(
			screen.getByRole("heading", { name: /^ai news reader$/i }),
		).toBeInTheDocument();
		expect(
			screen.getByText(/the ai triad answers three questions/i),
		).toBeInTheDocument();
		// Cross-links to the other topic pages and source lists.
		expect(
			screen.getByRole("link", { name: /local-first news reader/i }),
		).toHaveAttribute("href", "/local-first/");
		expect(
			screen.getByRole("link", { name: /24 developer rss feeds/i }),
		).toHaveAttribute("href", "/sources/developer/");
		// The download CTA goes to the home page's platform section.
		expect(
			screen.getByRole("link", { name: /download vorynth/i }),
		).toHaveAttribute("href", "/#platforms");
	});

	it("renders every topic page with its own keyword h1", () => {
		const cases = [
			{ slug: "personal-intelligence", h1: /^personal intelligence engine$/i },
			{ slug: "local-first", h1: /^local-first news reader$/i },
			{ slug: "rss-reader", h1: /^rss reader & news aggregator$/i },
			{ slug: "open-source", h1: /^open source news reader$/i },
		];
		for (const { slug, h1 } of cases) {
			// Fresh render per page — the slug is read from the prop.
			const { unmount } = render(<TopicPage slug={slug} />);
			expect(screen.getByRole("heading", { name: h1 })).toBeInTheDocument();
			unmount();
		}
	});

	it("renders the explore fallback for an unknown slug", () => {
		render(<TopicPage slug="does-not-exist" />);
		expect(
			screen.getByRole("heading", { name: /^explore vorynth$/i }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: /^ai news reader$/i }),
		).toBeInTheDocument();
	});
});
