import { beforeEach, describe, expect, it } from "vitest";
import { en, type TranslationCatalog } from "./en.js";
import { fa } from "./fa.js";
import { ar } from "./ar.js";
import { ko } from "./ko.js";
import { ja } from "./ja.js";
import { zh } from "./zh.js";
import { he } from "./he.js";
import { es } from "./es.js";
import { de } from "./de.js";
import { ru } from "./ru.js";
import { BUNDLED_CODES, BUNDLED_LANGUAGES } from "./locales.js";
import { useLocaleStore } from "./locale-store.js";

const CATALOGS: Record<string, TranslationCatalog> = {
	en,
	fa,
	ar,
	ko,
	ja,
	zh,
	he,
	es,
	de,
	ru,
};

function flattenKeys(obj: Record<string, unknown>, prefix = ""): string[] {
	const keys: string[] = [];
	for (const [key, value] of Object.entries(obj)) {
		const path = prefix ? `${prefix}.${key}` : key;
		if (typeof value === "object" && value !== null) {
			keys.push(...flattenKeys(value as Record<string, unknown>, path));
		} else {
			keys.push(path);
		}
	}
	return keys.sort();
}

describe("bundled catalogs", () => {
	it("every bundled catalog carries exactly the English catalog's keys", () => {
		const enKeys = flattenKeys(en);
		for (const [code, catalog] of Object.entries(CATALOGS)) {
			expect(flattenKeys(catalog), `${code} catalog keys`).toEqual(enKeys);
		}
	});
});

describe("BUNDLED_LANGUAGES", () => {
	it("labels carry the native name, English name, and code", () => {
		expect(BUNDLED_LANGUAGES.find((l) => l.code === "fa")?.label).toBe(
			"فارسی — Persian (fa)",
		);
		expect(BUNDLED_LANGUAGES.find((l) => l.code === "en")?.label).toBe(
			"English — English (en)",
		);
	});

	it("marks RTL locales as rtl and the rest as ltr", () => {
		for (const code of ["fa", "ar", "he"]) {
			expect(BUNDLED_LANGUAGES.find((l) => l.code === code)?.direction).toBe(
				"rtl",
			);
		}
		for (const code of ["en", "ko", "ja", "zh", "es", "de", "ru"]) {
			expect(BUNDLED_LANGUAGES.find((l) => l.code === code)?.direction).toBe(
				"ltr",
			);
		}
	});
});

describe("useLocaleStore", () => {
	beforeEach(() => {
		window.localStorage.clear();
		useLocaleStore.setState(useLocaleStore.getInitialState());
	});

	it("lists the 10 bundled languages first", () => {
		expect(useLocaleStore.getState().locales.map((l) => l.code)).toEqual([
			...BUNDLED_CODES,
		]);
		expect(useLocaleStore.getState().locales.every((l) => l.builtIn)).toBe(
			true,
		);
	});

	it("appends imported extras after the bundled list", () => {
		useLocaleStore.getState().registerCatalog("fr", "FR (imported)", { ...en });
		const codes = useLocaleStore.getState().locales.map((l) => l.code);
		expect(codes).toEqual([...BUNDLED_CODES, "fr"]);
		expect(useLocaleStore.getState().customLocales.map((l) => l.code)).toEqual([
			"fr",
		]);
	});

	it("removing an imported extra restores the plain bundled list", () => {
		useLocaleStore.getState().registerCatalog("fr", "FR (imported)", { ...en });
		useLocaleStore.getState().removeCatalog("fr");
		expect(useLocaleStore.getState().locales.map((l) => l.code)).toEqual([
			...BUNDLED_CODES,
		]);
	});
});
