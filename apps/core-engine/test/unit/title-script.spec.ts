import { titleNeedsTranslation } from "../../src/modules/intelligence/title-script.js";

/**
 * Title-script detection (v1.8.1) — "only translate when needed". A title
 * already written in the target language's distinctive script doesn't need a
 * translation (same-language "translations" garble meaning). Latin-script
 * targets can't be detected this way and always translate.
 */
describe("titleNeedsTranslation (v1.8.1)", () => {
	it("Persian target: a Persian title needs no translation", () => {
		expect(titleNeedsTranslation("آپدیت مهم منتشر شد", "fa")).toBe(false);
		// Latin brand words inside a Persian title don't change that.
		expect(titleNeedsTranslation("آپدیت OpenAI منتشر شد", "fa")).toBe(false);
	});

	it("Persian target: a Latin-only title still translates", () => {
		expect(titleNeedsTranslation("OpenAI releases GPT-5", "fa")).toBe(true);
	});

	it("Russian target: a Cyrillic title needs no translation, a Latin one does", () => {
		expect(titleNeedsTranslation("Обновление вышло", "ru")).toBe(false);
		expect(titleNeedsTranslation("Big release today", "ru")).toBe(true);
	});

	it("Hebrew / Arabic targets use their script", () => {
		expect(titleNeedsTranslation("עדכון חשוב", "he")).toBe(false);
		expect(titleNeedsTranslation("تحديث مهم", "ar")).toBe(false);
		expect(titleNeedsTranslation("Breaking news", "ar")).toBe(true);
	});

	it("CJK: Japanese kana marks Japanese, Han alone marks Chinese", () => {
		expect(titleNeedsTranslation("リリースのお知らせ", "ja")).toBe(false);
		expect(titleNeedsTranslation("重要更新", "zh")).toBe(false);
		expect(titleNeedsTranslation("Major update", "ja")).toBe(true);
	});

	it("Latin-script targets (en/de/es) always translate — script can't tell", () => {
		expect(titleNeedsTranslation("German title hier", "en")).toBe(true);
		expect(titleNeedsTranslation("English title", "de")).toBe(true);
		expect(titleNeedsTranslation("cualquier título", "es")).toBe(true);
	});

	it("unknown languages default to translating", () => {
		expect(titleNeedsTranslation("xyz", "xx")).toBe(true);
	});
});
