import ISO6391 from "iso-639-1";
import { directionFor, type TextDirection } from "./types.js";

/**
 * The UI languages Vorynth ships with. Each code has a bundled translation
 * catalog in this folder (`./<code>.ts`), all type-checked against the English
 * catalog. Users can still import their own catalogs for any other language,
 * or to override one of these (see `locale-store.ts`).
 */

export const BUNDLED_CODES: readonly string[] = [
	"en",
	"fa",
	"ar",
	"ko",
	"ja",
	"zh",
	"he",
	"es",
	"de",
	"ru",
];

export interface BundledLanguage {
	code: string;
	/** English name, e.g. "Persian". */
	name: string;
	/** Native name, e.g. "فارسی". */
	nativeName: string;
	/** Selector label: native name — English name (code). */
	label: string;
	direction: TextDirection;
}

export const BUNDLED_LANGUAGES: BundledLanguage[] = BUNDLED_CODES.map(
	(code) => {
		const name = ISO6391.getName(code);
		const nativeName = ISO6391.getNativeName(code);
		return {
			code,
			name,
			nativeName,
			label: `${nativeName} — ${name} (${code})`,
			direction: directionFor(code),
		};
	},
);
