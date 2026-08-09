import { useLocation } from "react-router-dom";

/**
 * "Did the user actually come from somewhere?" — v1.9.0.
 *
 * The old check (`location.key !== "default"`) is unreliable: `"default"` is
 * only assigned when `window.history.state` carries no key, i.e. a truly fresh
 * load. A browser RELOAD of a page that was reached through in-app navigation
 * preserves `history.state` (including the real uuid key), so `/plugins`
 * reloaded directly still reported "has history" and showed a back button —
 * while the same URL with a trailing slash (`/plugins/`) got a fresh state and
 * hid it. Whether the button appears must not depend on URL spelling.
 *
 * This module records the FIRST `location.key` the app ever saw (the initial
 * entry — deep link or restored session) and compares every later location
 * against it. A navigation from within the app produces a different key → back
 * is shown. Landing directly — any spelling — matches the initial key → back
 * is hidden, consistently.
 *
 * The initial key is captured module-wide so a remount of a page (e.g. going
 * to `/plugins`, back, and forward again) doesn't reset what "first" means.
 */

let initialKey: string | null = null;

/** Record the app's first location key once (call from the app root). */
export function captureInitialLocationKey(key: string): void {
	if (initialKey === null) initialKey = key;
}

/** Whether a location key differs from the app's initial one. */
export function locationHasHistory(key: string): boolean {
	return initialKey !== null && key !== initialKey;
}

/**
 * Hook for pages that render a conditional back button: `true` when the user
 * navigated here from inside the app, `false` on a direct deep link / restored
 * session (regardless of trailing slash).
 */
export function useHasHistory(): boolean {
	const location = useLocation();
	return locationHasHistory(location.key);
}
