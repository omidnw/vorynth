import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { en } from "./en.js";
import { fa } from "./fa.js";
import { ar } from "./ar.js";
import { ko } from "./ko.js";
import { ja } from "./ja.js";
import { zh } from "./zh.js";
import { he } from "./he.js";
import { es } from "./es.js";
import { de } from "./de.js";
import { ru } from "./ru.js";

/**
 * The localStorage key that persists the active UI language. Lives here (not in
 * the locale store) so the instance can read it at init time without a circular
 * import: the locale store already imports this module.
 */
export const ACTIVE_LOCALE_KEY = "vorynth.locale.active";

/**
 * The language to boot in: whatever the user last picked (persisted by the
 * locale store), English otherwise. Read directly from localStorage at module
 * scope so i18next is born in the right language — an async switch after first
 * paint would flash the UI in English first.
 */
function persistedLanguage(): string {
	if (typeof window === "undefined") return "en";
	return window.localStorage.getItem(ACTIVE_LOCALE_KEY) ?? "en";
}

/**
 * i18next instance. Ten languages ship bundled (see `locales.ts`); any other
 * language is registered at runtime by the locale store when the user imports
 * a translated catalog.
 */
void i18next.use(initReactI18next).init({
	resources: {
		en: { translation: en },
		fa: { translation: fa },
		ar: { translation: ar },
		ko: { translation: ko },
		ja: { translation: ja },
		zh: { translation: zh },
		he: { translation: he },
		es: { translation: es },
		de: { translation: de },
		ru: { translation: ru },
	},
	lng: persistedLanguage(),
	fallbackLng: "en",
	interpolation: { escapeValue: false },
	returnNull: false,
});

export default i18next;
