import { apiFetch } from "@/lib/api/config";
import type { RecordStoryViewInput, StoryViewList } from "@vorynth/types";

/**
 * Story-view history (v1.8.0) — which story the user opened, when, and on
 * which surface (insight page / article / both). Recorded automatically when
 * a story's insight or article page mounts; surfaced in the Brief page's
 * History tab.
 */

/** Record an open. Best-effort — callers fire-and-forget; a failed record
 *  must never break reading (the engine merges same-sitting opens into
 *  `both`). */
export function recordStoryView(input: RecordStoryViewInput): Promise<unknown> {
	return apiFetch("/story-views", {
		method: "POST",
		body: JSON.stringify(input),
	});
}

/** Recent story views, newest first, joined with the article titles. */
export function fetchStoryViews(limit = 50): Promise<StoryViewList> {
	return apiFetch(`/story-views?limit=${limit}`);
}
