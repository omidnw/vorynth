/**
 * Title-script detection (v1.8.1) — "only translate when needed".
 *
 * For intelligence languages whose written form uses a distinctive script, a
 * title ALREADY written in that script does not need a translation: sending
 * e.g. a Persian title through a "translate to Persian" call rewrites it with
 * a near-identical copy and can garble the meaning (the user's report).
 *
 * Latin-script targets (en/de/es/…) can't be detected this way — English and
 * German share the alphabet — so those keep relying on `source_language`
 * metadata (the existing same-language guard) and translate untagged sources
 * as before.
 *
 * A title counts as "already in the script" as soon as it contains the
 * script's characters — a Persian title with Latin brand words (e.g.
 * "آپدیت OpenAI منتشر شد") is still Persian. Latin-only titles have none of
 * those characters, so they still translate.
 */

const SCRIPT_TESTS: Record<string, (title: string) => boolean> = {
	// Arabic script — Persian and Arabic share it; an untagged Arabic title
	// targeting Persian is a rare edge, and the metadata guard covers the
	// exact same-language case when the source is tagged.
	fa: (t) => /[\u0600-\u06FF]/.test(t),
	ar: (t) => /[\u0600-\u06FF]/.test(t),
	he: (t) => /[\u0590-\u05FF]/.test(t),
	ru: (t) => /[\u0400-\u04FF]/.test(t),
	uk: (t) => /[\u0400-\u04FF]/.test(t),
	el: (t) => /[\u0370-\u03FF]/.test(t),
	th: (t) => /[\u0E00-\u0E7F]/.test(t),
	hi: (t) => /[\u0900-\u097F]/.test(t),
	// CJK — Chinese shares Han with Japanese; Kana marks Japanese-only text.
	ja: (t) => /[\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF]/.test(t),
	ko: (t) => /[\uAC00-\uD7AF\u1100-\u11FF]/.test(t),
	zh: (t) => /[\u3400-\u4DBF\u4E00-\u9FFF]/.test(t),
};

/**
 * Whether a story title needs translation into `targetLanguage`.
 *
 * Returns `false` (no translation needed) when the title is already written
 * in the target language's distinctive script; `true` otherwise — including
 * every Latin-script target, which the script heuristic can't judge and which
 * therefore keeps the metadata-only behavior.
 */
export function titleNeedsTranslation(
	title: string,
	targetLanguage: string,
): boolean {
	const test = SCRIPT_TESTS[targetLanguage.toLowerCase()];
	if (!test) return true;
	return !test(title);
}
