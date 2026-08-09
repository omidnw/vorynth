import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { isHtml, RichContent, stripHtml } from "./RichContent.js";

/**
 * RichContent (v1.8.0) — collected story bodies may carry feed HTML. They must
 * render formatted (bold, links) instead of showing raw tags, and the markup
 * is untrusted external data, so it is sanitized: scripts and event handlers
 * are stripped, javascript: links are blocked, and links open safely in a new
 * tab. Plain-text bodies pass through unchanged.
 */
describe("RichContent — sanitized HTML rendering", () => {
	it("renders plain text without markup processing", () => {
		render(<RichContent text="Just a plain body." />);
		expect(screen.getByText("Just a plain body.")).toBeInTheDocument();
		expect(document.querySelector(".rich-content")).toBeNull();
	});

	it("renders feed HTML with formatting instead of raw tags", () => {
		render(
			<RichContent text='<p><strong><a href="https://example.com/x">MiniMax-H3</a></strong> released.</p>' />,
		);
		expect(screen.queryByText(/<p><strong>/)).toBeNull();
		const link = screen.getByRole("link", { name: "MiniMax-H3" });
		expect(link.getAttribute("href")).toBe("https://example.com/x");
		expect(link.getAttribute("target")).toBe("_blank");
		expect(link.getAttribute("rel")).toContain("noopener");
		expect(document.querySelector(".rich-content strong")).not.toBeNull();
	});

	it("strips scripts and event-handler attributes", () => {
		render(
			<RichContent text='<p onclick="alert(1)">Text</p><script>window.pwned=1</script><img src=x onerror="alert(2)" />' />,
		);
		expect(screen.getByText("Text")).toBeInTheDocument();
		expect(document.querySelector("script")).toBeNull();
		expect(document.querySelector("img")).toBeNull();
		expect(document.querySelector("[onclick]")).toBeNull();
		expect(document.querySelector("[onerror]")).toBeNull();
	});

	it("blocks javascript: and data: link targets", () => {
		render(
			<RichContent text='<a href="javascript:alert(1)">Bad</a><a href="data:text/html,x">Data</a><a href="https://ok.example">Ok</a>' />,
		);
		const links = Array.from(document.querySelectorAll("a"));
		const hrefs = links.map((a) => a.getAttribute("href"));
		expect(hrefs).toContain("https://ok.example");
		expect(hrefs.every((h) => !h || h.startsWith("https://"))).toBe(true);
	});

	it("strips class/style attributes but keeps title", () => {
		render(
			<RichContent text='<span class="evil" style="position:fixed">Styled</span><p title="note">Note</p>' />,
		);
		const span = document.querySelector("span");
		expect(span?.getAttribute("class")).toBeNull();
		expect(span?.getAttribute("style")).toBeNull();
		expect(document.querySelector('[title="note"]')).not.toBeNull();
	});
});

describe("isHtml / stripHtml", () => {
	it("detects feed markup and strips tags for plain-text previews", () => {
		const body =
			'<p><strong><a href="https://github.com/x">Repo</a></strong></p> MiniMax released.';
		expect(isHtml(body)).toBe(true);
		expect(isHtml("Plain text, no markup.")).toBe(false);
		expect(stripHtml(body).replace(/\s+/g, " ").trim()).toBe(
			"Repo MiniMax released.",
		);
	});

	it("does not treat a math expression as HTML", () => {
		expect(isHtml("The result is a < b and c > d")).toBe(false);
	});
});
