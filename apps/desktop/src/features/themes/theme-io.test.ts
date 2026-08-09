import { describe, expect, it } from "vitest";
import { parseThemeJson, themeAiPrompt, themeToJson } from "./theme-io.js";

const VALID = JSON.stringify({
	id: "aurora",
	name: "Aurora",
	light: { "--color-primary": "120 200 255" },
	dark: { "--color-primary": "30 90 150" },
	icon: "solar_power",
});

describe("theme-io (v1.8.0)", () => {
	it("parses a valid theme", () => {
		const r = parseThemeJson(VALID);
		expect(r.ok).toBe(true);
		if (r.ok) {
			expect(r.theme.id).toBe("aurora");
			expect(r.theme.name).toBe("Aurora");
			expect(r.theme.light["--color-primary"]).toBe("120 200 255");
			expect(r.theme.dark["--color-primary"]).toBe("30 90 150");
			expect(r.theme.icon).toBe("solar_power");
		}
	});

	it("rejects malformed JSON", () => {
		expect(parseThemeJson("{not json")).toEqual({
			ok: false,
			error: "settings.themeErrorInvalidJson",
		});
	});

	it("rejects reserved ids (light/dark)", () => {
		const r = parseThemeJson(
			JSON.stringify({ ...JSON.parse(VALID), id: "light" }),
		);
		expect(r).toEqual({ ok: false, error: "settings.themeErrorReservedId" });
	});

	it("rejects a missing or non-slug id", () => {
		const bad = JSON.stringify({ ...JSON.parse(VALID), id: "My Theme!" });
		expect(parseThemeJson(bad).ok).toBe(false);
	});

	it("rejects --color-* values that aren't r g b triplets", () => {
		const bad = JSON.stringify({
			...JSON.parse(VALID),
			light: { "--color-primary": "#7A6CFF" },
		});
		const r = parseThemeJson(bad);
		expect(r).toEqual({ ok: false, error: "settings.themeErrorBadTriplet" });
	});

	it("rejects a theme with no tokens at all", () => {
		const bad = JSON.stringify({ ...JSON.parse(VALID), light: {}, dark: {} });
		expect(parseThemeJson(bad)).toEqual({
			ok: false,
			error: "settings.themeErrorNoTokens",
		});
	});

	it("round-trips a theme through JSON", () => {
		const r = parseThemeJson(VALID);
		expect(r.ok).toBe(true);
		if (r.ok) {
			const again = parseThemeJson(themeToJson(r.theme));
			expect(again.ok).toBe(true);
			if (again.ok) expect(again.theme).toEqual(r.theme);
		}
	});

	it("embeds the theme JSON in the AI prompt", () => {
		const r = parseThemeJson(VALID);
		expect(r.ok).toBe(true);
		if (r.ok) {
			const prompt = themeAiPrompt(themeToJson(r.theme));
			expect(prompt).toContain("aurora");
			expect(prompt).toContain('"light"');
			expect(prompt).toContain("r g b");
		}
	});
});
