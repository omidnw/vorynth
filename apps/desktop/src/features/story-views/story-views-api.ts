import { apiFetch } from "@/lib/api/config";
import type {
	RecordStoryViewInput,
	SetStoryViewReadInput,
	StoryViewList,
	StoryViewScope,
} from "@vorynth/types";

/**
 * Story-view history (v1.8.0) — which story the user opened, when, and on
 * which surface (insight page / article / both). Recorded automatically when
 * a story's insight or article page mounts; surfaced in the Brief page's
 * History tab. v1.8.1 — opening marks the view read; the reader's "Mark
 * read" button toggles it via PATCH.
 */

export interface RecordStoryViewResult {
	id: number;
	scope: StoryViewScope;
}

/** Record an open. Best-effort — callers fire-and-forget; a failed record
 *  must never break reading (the engine merges same-sitting opens into
 *  `both` and marks the view read). */
export function recordStoryView(
	input: RecordStoryViewInput,
): Promise<RecordStoryViewResult> {
	return apiFetch("/story-views", {
		method: "POST",
		body: JSON.stringify(input),
	});
}

/** Toggle the read flag on a view row (the reader's "Mark read" button). */
export function setStoryViewRead(
	id: number,
	read: boolean,
): Promise<{ id: number; read: boolean }> {
	return apiFetch(`/story-views/${id}`, {
		method: "PATCH",
		body: JSON.stringify({ read } satisfies SetStoryViewReadInput),
	});
}

/**
 * v1.9.0 — mark a whole STORY read by article id (the brief-card "Mark read"
 * button): toggles the latest view row, creating one if the story was never
 * opened. Wired to `POST /story-views/article/:articleId/read`.
 */
export function setArticleRead(
	articleId: string,
	read: boolean,
): Promise<{ articleId: string; read: boolean }> {
	return apiFetch(
		`/story-views/article/${encodeURIComponent(articleId)}/read`,
		{
			method: "POST",
			body: JSON.stringify({ read } satisfies SetStoryViewReadInput),
		},
	);
}

/** Recent story views, newest first, joined with the article titles. */
export function fetchStoryViews(limit = 50): Promise<StoryViewList> {
	return apiFetch(`/story-views?limit=${limit}`);
}
