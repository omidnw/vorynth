import { create } from "zustand";
import i18n, { ACTIVE_LOCALE_KEY } from "./instance.js";
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
import { directionFor, type Locale } from "./types.js";
import { BUNDLED_CODES, BUNDLED_LANGUAGES } from "./locales.js";

/**
 * Locale store — owns the active locale, the registry of known locales, and
 * the persistence of any user-imported custom catalogs.
 *
 * Design:
 *   - 10 languages ship bundled (see `locales.ts`), each with a translation
 *     catalog in this folder.
 *   - Any other locale (fr, tr, …) is registered at runtime via
 *     `registerCatalog(code, label, catalog)`. The catalog comes from a JSON
 *     file the user translated themselves and imported. Importing a catalog
 *     for a bundled code overrides that bundle until it's removed.
 *   - Custom catalogs persist to localStorage so they survive reloads.
 *   - Direction (`ltr`/`rtl`) is derived from the locale code, so RTL locales
 *     (fa, ar, he, …) lay out RTL automatically. The store flips `<html dir>`
 *     and `<html lang>` whenever the active locale changes.
 */

const CUSTOM_KEY = "vorynth.locale.custom"; // code → { label, catalog }

/** Bundled catalogs keyed by code — used to restore a bundle a custom import overrode. */
const BUNDLED_CATALOGS: Record<string, TranslationCatalog> = {
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

interface LocaleState {
	/** Everything selectable: the bundled languages + imported extras. */
	locales: Locale[];
	/** User-imported catalogs only (incl. overrides of bundled codes). */
	customLocales: Locale[];
	active: string;
	/** Set the active locale; flips document direction. */
	setActive: (code: string) => void;
	/** Register a user-imported catalog (also persists it). */
	registerCatalog: (
		code: string,
		label: string,
		catalog: TranslationCatalog,
	) => void;
	/** Remove a custom locale (bundled languages cannot be removed). */
	removeCatalog: (code: string) => void;
	/** Get the English catalog as plain JSON for export. */
	exportEnglish: () => string;
}

interface PersistedCustom {
	label: string;
	catalog: TranslationCatalog;
}

function loadCustom(): Record<string, PersistedCustom> {
	if (typeof window === "undefined") return {};
	try {
		const raw = window.localStorage.getItem(CUSTOM_KEY);
		return raw ? (JSON.parse(raw) as Record<string, PersistedCustom>) : {};
	} catch {
		return {};
	}
}

function saveCustom(custom: Record<string, PersistedCustom>) {
	if (typeof window === "undefined") return;
	window.localStorage.setItem(CUSTOM_KEY, JSON.stringify(custom));
}

function applyDirection(code: string) {
	if (typeof document === "undefined") return;
	const dir = directionFor(code);
	document.documentElement.setAttribute("dir", dir);
	document.documentElement.setAttribute("lang", code);
}

function buildLocales(custom: Record<string, PersistedCustom>): Locale[] {
	const base: Locale[] = BUNDLED_LANGUAGES.map((lang) => ({
		code: lang.code,
		label: lang.label,
		direction: lang.direction,
		builtIn: true,
	}));
	for (const [code, entry] of Object.entries(custom)) {
		if (BUNDLED_CODES.includes(code)) continue; // bundled — the import overrides the bundle, not the list
		base.push({
			code,
			label: entry.label,
			direction: directionFor(code),
		});
	}
	return base;
}

function buildCustomLocales(custom: Record<string, PersistedCustom>): Locale[] {
	return Object.entries(custom).map(([code, entry]) => ({
		code,
		label: entry.label,
		direction: directionFor(code),
	}));
}

const initialCustom = loadCustom();
// Seed the i18next instance with persisted custom catalogs at module load.
for (const [code, entry] of Object.entries(initialCustom)) {
	i18n.addResourceBundle(code, "translation", entry.catalog, true, true);
}

const initialActive =
	(typeof window !== "undefined" &&
		window.localStorage.getItem(ACTIVE_LOCALE_KEY)) ||
	"en";

export const useLocaleStore = create<LocaleState>((set, get) => ({
	locales: buildLocales(initialCustom),
	customLocales: buildCustomLocales(initialCustom),
	active: initialActive,

	setActive: (code) => {
		if (typeof window !== "undefined")
			window.localStorage.setItem(ACTIVE_LOCALE_KEY, code);
		void i18n.changeLanguage(code);
		applyDirection(code);
		set({ active: code });
	},

	registerCatalog: (code, label, catalog) => {
		i18n.addResourceBundle(code, "translation", catalog, true, true);
		const custom = loadCustom();
		custom[code] = { label, catalog };
		saveCustom(custom);
		set({
			locales: buildLocales(custom),
			customLocales: buildCustomLocales(custom),
		});
	},

	removeCatalog: (code) => {
		if (code === "en") return; // bundled, cannot remove
		const custom = loadCustom();
		delete custom[code];
		saveCustom(custom);
		// A custom import may have overridden a bundled catalog — restore it.
		const bundled = BUNDLED_CATALOGS[code];
		if (bundled) {
			i18n.removeResourceBundle(code, "translation");
			i18n.addResourceBundle(code, "translation", bundled, true, true);
		}
		// If the removed one was active and it was a non-bundled language, fall
		// back to English. Bundled codes keep their restored catalog.
		if (get().active === code && !BUNDLED_CODES.includes(code)) {
			get().setActive("en");
		}
		set({
			locales: buildLocales(custom),
			customLocales: buildCustomLocales(custom),
		});
	},

	exportEnglish: () => JSON.stringify(en, null, 2),
}));

/** Call once at startup to sync document direction with the persisted locale. */
export function initLocale() {
	applyDirection(useLocaleStore.getState().active);
}
