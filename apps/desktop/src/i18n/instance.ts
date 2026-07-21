import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { en } from "./en.js";

/**
 * i18next instance. English is the only bundled resource; every other
 * language is registered at runtime by the locale store when the user imports
 * a translated catalog.
 */
void i18next.use(initReactI18next).init({
	resources: {
		en: { translation: en },
	},
	lng: "en",
	fallbackLng: "en",
	interpolation: { escapeValue: false },
	returnNull: false,
});

export default i18next;
