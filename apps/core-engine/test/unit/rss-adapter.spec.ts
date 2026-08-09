import { toCreatorName } from "../../src/modules/crawler/adapters/rss-adapter.js";

/**
 * RSS adapter creator normalization (v1.8.0 fix).
 *
 * Some feeds (e.g. blog.google) nest elements inside `<dc:creator>`, which
 * makes rss-parser return a structured object instead of a string. The author
 * must always be a plain string — an object reaching the DB write path crashes
 * the whole source collect (better-sqlite3 bind failure).
 */
describe("RssAdapter.toCreatorName", () => {
	it("passes a plain string through", () => {
		expect(toCreatorName("John Doe")).toBe("John Doe");
		expect(toCreatorName("  John Doe  ")).toBe("John Doe");
	});

	it("returns undefined for an empty string", () => {
		expect(toCreatorName("")).toBeUndefined();
		expect(toCreatorName("   ")).toBeUndefined();
	});

	it("extracts the name from a structured <dc:creator> object", () => {
		// blog.google's feed shape: rss-parser yields the nested XML as an object.
		const structured = {
			$: { "xmlns:author": "http://www.w3.org/2005/Atom" },
			name: ["News from Google Team"],
			title: [""],
			department: [""],
			company: [""],
		};
		expect(toCreatorName(structured)).toBe("News from Google Team");
	});

	it("handles a single-element object name", () => {
		expect(toCreatorName({ name: "Alice" })).toBe("Alice");
	});

	it("joins multiple creator values", () => {
		expect(toCreatorName(["Alice", "Bob"])).toBe("Alice, Bob");
	});

	it("returns undefined for anything unstringable", () => {
		expect(toCreatorName(42)).toBeUndefined();
		expect(toCreatorName(null)).toBeUndefined();
		expect(toCreatorName(undefined)).toBeUndefined();
		expect(toCreatorName({ name: 42 })).toBeUndefined();
	});
});
