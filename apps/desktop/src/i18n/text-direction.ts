import { useCallback } from "react";
import { useLocaleStore } from "./locale-store.js";
import { directionFor, type TextDirection } from "./types.js";

/**
 * Content text-direction detection (v1.7.0).
 *
 * The app's static text is `dir="auto"`, which only looks at the FIRST strong
 * directional character — so a Persian paragraph that opens with a URL, a
 * number, or a quote renders LTR. For story/AI content we instead scan the
 * whole string and use the DOMINANT direction, falling back to the user's UI
 * language direction when the text is neutral or empty. That way a translated
 * story renders RTL even when it starts with a link, and an English original
 * stays LTR no matter which box it lands in.
 */

const RTL_CHAR = /[\u0590-\u07FF\u08A0-\u08FF\uFB1D-\uFDFD\uFE70-\uFEFC]/;
const LETTER = /\p{L}/u;

/**
 * Dominant direction of the text, or `null` when it's neutral/empty (no strong
 * directional letters, or an exact RTL/LTR tie).
 */
export function detectTextDirection(text: string): TextDirection | null {
	let rtl = 0;
	let ltr = 0;
	for (const ch of text) {
		if (RTL_CHAR.test(ch)) rtl++;
		else if (LETTER.test(ch)) ltr++;
	}
	if (rtl === 0 && ltr === 0) return null;
	if (rtl > ltr) return "rtl";
	if (ltr > rtl) return "ltr";
	return null;
}

/** Direction of `text`, preferring its own dominant direction, else `fallback`. */
export function dirForText(
	text: string,
	fallback: TextDirection,
): TextDirection {
	return detectTextDirection(text) ?? fallback;
}

/**
 * Hook: returns a stable `dir(text)` function whose fallback is the user's
 * active UI language direction (the same source that flips `<html dir>`).
 */
export function useTextDirection(): (text: string) => TextDirection {
	const active = useLocaleStore((s) => s.active);
	const fallback = directionFor(active);
	return useCallback((text: string) => dirForText(text, fallback), [fallback]);
}
