/**
 * i18n barrel. Import `initI18n` once in `main.tsx` before React mounts; use
 * `useTranslation` from `react-i18next` (re-exported here) in components.
 */
export { default } from "./instance.js";
export { useLocaleStore, initLocale } from "./locale-store.js";
export { en, type TranslationCatalog } from "./en.js";
export {
	directionFor,
	RTL_LOCALES,
	type Locale,
	type TextDirection,
} from "./types.js";
export { useTranslation } from "react-i18next";
