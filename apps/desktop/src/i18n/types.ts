/**
 * Catalog + locale types.
 *
 * A `Locale` is: a BCP-47 code, a direction, and a translation catalog. Only
 * English ships built-in; every other locale is registered at runtime from a
 * catalog the user imported (see `locale-store.ts` → `registerCatalog`).
 *
 * RTL is decided per-locale, not hardcoded — the store flips `<html dir>` and
 * `dir=` on the root element when the active locale's direction changes.
 */

export type TextDirection = "ltr" | "rtl";

export interface Locale {
	/** BCP-47 code, e.g. "en", "fa", "ar", "he". */
	code: string;
	/** Human label shown in the selector, in that language. */
	label: string;
	direction: TextDirection;
	/** True for the built-in English locale. */
	builtIn?: boolean;
}

/**
 * Locales commonly written right-to-left. Direction is derived from the locale
 * code so a user-imported `fa.json` is automatically laid out RTL — no extra
 * metadata required in the catalog file itself.
 */
export const RTL_LOCALES = new Set([
	"ar",
	"he",
	"fa",
	"ur",
	"yi",
	"ps",
	"sd",
	"ckb",
	"ug",
	"dv",
]);

export function directionFor(code: string): TextDirection {
	const base = code.toLowerCase().split("-")[0] ?? code;
	return RTL_LOCALES.has(base) ? "rtl" : "ltr";
}

/** Format the active locale's metadata for the selector + storage. */
export function makeLocale(code: string, label: string): Locale {
	return { code, label, direction: directionFor(code) };
}
