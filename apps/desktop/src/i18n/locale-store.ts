import { create } from "zustand";
import i18n from "./instance.js";
import { en, type TranslationCatalog } from "./en.js";
import { directionFor, type Locale } from "./types.js";

/**
 * Locale store — owns the active locale, the registry of known locales, and
 * the persistence of any user-imported custom catalogs.
 *
 * Design:
 *   - English is always present and built-in.
 *   - Any other locale (fa, ar, he, …) is registered at runtime via
 *     `registerCatalog(code, label, catalog)`. The catalog comes from a JSON
 *     file the user translated themselves and imported.
 *   - Custom catalogs persist to localStorage so they survive reloads.
 *   - Direction (`ltr`/`rtl`) is derived from the locale code, so an imported
 *     `fa.json` lays out RTL automatically. The store flips `<html dir>` and
 *     `<html lang>` whenever the active locale changes.
 */

const ACTIVE_KEY = "vorynth.locale.active";
const CUSTOM_KEY = "vorynth.locale.custom"; // code → { label, catalog }

interface LocaleState {
	locales: Locale[];
	active: string;
	/** Set the active locale; flips document direction. */
	setActive: (code: string) => void;
	/** Register a user-imported catalog (also persists it). */
	registerCatalog: (
		code: string,
		label: string,
		catalog: TranslationCatalog,
	) => void;
	/** Remove a custom locale (English cannot be removed). */
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
	const base: Locale[] = [
		{ code: "en", label: "English", direction: "ltr", builtIn: true },
	];
	for (const [code, entry] of Object.entries(custom)) {
		base.push({
			code,
			label: entry.label,
			direction: directionFor(code),
		});
	}
	return base;
}

const initialCustom = loadCustom();
// Seed the i18next instance with persisted custom catalogs at module load.
for (const [code, entry] of Object.entries(initialCustom)) {
	i18n.addResourceBundle(code, "translation", entry.catalog, true, true);
}

const initialActive =
	(typeof window !== "undefined" && window.localStorage.getItem(ACTIVE_KEY)) ||
	"en";

export const useLocaleStore = create<LocaleState>((set, get) => ({
	locales: buildLocales(initialCustom),
	active: initialActive,

	setActive: (code) => {
		if (typeof window !== "undefined")
			window.localStorage.setItem(ACTIVE_KEY, code);
		void i18n.changeLanguage(code);
		applyDirection(code);
		set({ active: code });
	},

	registerCatalog: (code, label, catalog) => {
		i18n.addResourceBundle(code, "translation", catalog, true, true);
		const custom = loadCustom();
		custom[code] = { label, catalog };
		saveCustom(custom);
		set({ locales: buildLocales(custom) });
	},

	removeCatalog: (code) => {
		if (code === "en") return; // built-in, cannot remove
		const custom = loadCustom();
		delete custom[code];
		saveCustom(custom);
		// If the removed one was active, fall back to English.
		if (get().active === code) {
			get().setActive("en");
		}
		set({ locales: buildLocales(custom) });
	},

	exportEnglish: () => JSON.stringify(en, null, 2),
}));

/** Call once at startup to sync document direction with the persisted locale. */
export function initLocale() {
	applyDirection(useLocaleStore.getState().active);
}
