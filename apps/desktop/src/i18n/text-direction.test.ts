import { describe, expect, it } from "vitest";
import { detectTextDirection, dirForText } from "./text-direction.js";

/**
 * Dominant-direction detection (v1.7.0) — RTL/LTR per content box.
 *
 * `dir="auto"` only looks at the FIRST strong character, which misfires when a
 * right-to-left text opens with a URL, number, or emoji. The detector counts
 * strong characters across the whole string and lets the majority win; when
 * the text is neutral or tied, it falls back to the active UI language
 * (`dirForText`).
 */
describe("detectTextDirection", () => {
	it("detects Persian as rtl", () => {
		expect(detectTextDirection("سلام، این یک متن فارسی است")).toBe("rtl");
	});

	it("detects Arabic as rtl", () => {
		expect(detectTextDirection("هذا نص عربي")).toBe("rtl");
	});

	it("detects Hebrew as rtl", () => {
		expect(detectTextDirection("זהו טקסט בעברית")).toBe("rtl");
	});

	it("detects English as ltr", () => {
		expect(detectTextDirection("This is an English sentence.")).toBe("ltr");
	});

	it("detects rtl even when the text opens with a URL (dir=auto would fail)", () => {
		const text = "https://example.com سلام دنیا این یک خبر فنی است";
		expect(detectTextDirection(text)).toBe("rtl");
	});

	it("detects rtl when the text opens with digits", () => {
		expect(detectTextDirection("۱۲۳ عدد و سپس متن فارسی")).toBe("rtl");
	});

	it("lets the majority win for mixed Persian + English text", () => {
		expect(
			detectTextDirection(
				"این یک متن طولانی فارسی است که عمدتاً فارسی است اما چند واژه English هم دارد",
			),
		).toBe("rtl");
	});

	it("lets ltr win for mostly-English text with one Persian word", () => {
		expect(
			detectTextDirection("Mostly English prose with one فارسی word"),
		).toBe("ltr");
	});

	it("returns null for empty and neutral-only text", () => {
		expect(detectTextDirection("")).toBeNull();
		expect(detectTextDirection("123 456 (2026)")).toBeNull();
		expect(detectTextDirection("!!!")).toBeNull();
	});

	it("returns null on a tie so the UI-language fallback can decide", () => {
		// One Latin letter + one Persian letter — ambiguous.
		expect(detectTextDirection("a ب")).toBeNull();
	});
});

describe("dirForText", () => {
	it("falls back to the UI direction for neutral text", () => {
		expect(dirForText("", "rtl")).toBe("rtl");
		expect(dirForText("42", "ltr")).toBe("ltr");
	});

	it("prefers the detected direction over the fallback", () => {
		expect(dirForText("متن فارسی", "ltr")).toBe("rtl");
		expect(dirForText("English text", "rtl")).toBe("ltr");
	});
});
