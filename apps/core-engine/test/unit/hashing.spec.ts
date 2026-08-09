import { articleHash } from "../../src/modules/crawler/hashing.js";

/**
 * Dedup hashing — the crawler's first line of defense against duplicate
 * stories (project-details.md §21). Determinism and normalization matter:
 * the same story re-fetched must hash identically so it collapses to one row.
 */
describe("articleHash", () => {
	const base = {
		title: "Hello World",
		publishedAt: new Date("2026-07-01T10:00:00Z"),
		sourceId: "src-x",
	};

	it("is deterministic for identical input", () => {
		expect(articleHash(base)).toBe(articleHash(base));
	});

	it("normalizes title case and whitespace", () => {
		expect(articleHash({ ...base, title: "hello   WORLD" })).toBe(
			articleHash(base),
		);
		expect(articleHash({ ...base, title: "  Hello World  " })).toBe(
			articleHash(base),
		);
	});

	it("differentiates by source", () => {
		expect(articleHash({ ...base, sourceId: "src-y" })).not.toBe(
			articleHash(base),
		);
	});

	it("treats a missing publishedAt as 'unknown' (stable)", () => {
		expect(articleHash({ title: "T", sourceId: "src-z" })).toBe(
			articleHash({ title: "T", sourceId: "src-z" }),
		);
	});
});
