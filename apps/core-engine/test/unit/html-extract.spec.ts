import {
	extractArticle,
	htmlToReadableText,
} from "../../src/modules/crawler/adapters/html-extract.js";

/**
 * Shared HTML extraction (v1.8.0) — the content-quality fix: inline `<script>`
 * JSON and `<audio>/<video>` fallback chrome must not leak into the extracted
 * body (the Google AI Blog junk from the user's report).
 */
const PAGE = `<!doctype html><html><head><title>July updates</title></head><body>
  <article>
    <h1>July AI updates</h1>
    <script type="application/ld+json">{"play_video": "Play video", "pause_video": "Pause video"}</script>
    <p>Google released a bunch of new AI updates in July.</p>
    <audio controls>
      Your browser does not support the audio element.
      <source src="x.mp3" />
    </audio>
    <p>{ "reading_time": "[[read-time]] min read" }</p>
    <p>They launched faster Gemini models and better music tools.</p>
  </article>
</body></html>`;

describe("extractArticle — content quality", () => {
	it("keeps the prose and drops inline JSON + audio chrome", () => {
		const page = extractArticle(PAGE, "https://example.com/x", {});
		expect(page.content).toContain("Google released a bunch of new AI updates");
		expect(page.content).toContain("faster Gemini models");
		expect(page.content).not.toContain("play_video");
		expect(page.content).not.toContain("browser does not support");
		expect(page.content).not.toContain("reading_time");
		expect(page.content).not.toContain("[[");
		expect(page.content).not.toContain("{");
	});

	it("still extracts a body when a content selector is given", () => {
		const page = extractArticle(PAGE, "https://example.com/x", {
			contentSelector: "article",
		});
		expect(page.content).toContain("July AI updates");
		expect(page.content).not.toContain("play_video");
	});

	it("preserves paragraph breaks at block boundaries (readability)", () => {
		const page = extractArticle(
			`<!doctype html><html><body><article>
				<p>First paragraph about agents.</p>
				<h2>Set the ground rules</h2>
				<p>We started by defining principles.</p>
				<ul><li>One</li><li>Two</li></ul>
			</article></body></html>`,
			"https://example.com/x",
			{},
		);
		// Each block element is separated by a blank line in the flattened text,
		// so the body keeps its reading structure instead of one wall of words.
		expect(page.content).toContain(
			"First paragraph about agents.\n\nSet the ground rules",
		);
		expect(page.content).toContain("ground rules\n\nWe started");
		expect(page.content).toContain("One\n\nTwo");
	});
});

describe("htmlToReadableText — tables + feed content (v1.8.0)", () => {
	it("turns a table into a markdown pipe block instead of flattened cells", () => {
		const html = `<article>
			<p>Five layers of defense.</p>
			<table>
				<thead><tr><th>Risk</th><th>Control layer</th><th>What happens</th></tr></thead>
				<tbody>
					<tr><td>Hallucination</td><td>Provenance</td><td>The agent invents plausible-but-wrong output.</td></tr>
					<tr><td>Ungated output</td><td>Policy</td><td>No independent gate stops broken changes.</td></tr>
				</tbody>
			</table>
			<p>End of post.</p>
		</article>`;
		const text = htmlToReadableText(html);
		// Cells keep their row/column structure (pipe block), not disjoint lines.
		expect(text).toContain("| Risk | Control layer | What happens |");
		expect(text).toContain(
			"| Hallucination | Provenance | The agent invents plausible-but-wrong output. |",
		);
		expect(text).toContain(
			"| Ungated output | Policy | No independent gate stops broken changes. |",
		);
		// Prose around the table still reads as paragraphs.
		expect(text).toContain("Five layers of defense.\n\n| Risk");
		expect(text).toContain("|\n\nEnd of post.");
		// A pipe inside a cell is escaped so the block stays aligned.
		const escaped = htmlToReadableText(
			"<table><tr><td>a | b</td><td>c</td></tr></table>",
		);
		expect(escaped).toContain("| a \\| b | c |");
	});

	it("drops empty tables and script/style chrome like extractArticle", () => {
		const text = htmlToReadableText(
			`<body><script>{"junk":true}</script><table></table><p>Real prose.</p></body>`,
		);
		expect(text).toContain("Real prose.");
		expect(text).not.toContain("junk");
		expect(text).not.toContain("|");
	});

	it("collapses non-breaking spaces from feed HTML", () => {
		const text = htmlToReadableText(
			"<p>HCP\u00a0Terraform\u00a0is\u00a0the\u00a0control\u00a0plane.</p>",
		);
		expect(text).toBe("HCP Terraform is the control plane.");
	});
});
