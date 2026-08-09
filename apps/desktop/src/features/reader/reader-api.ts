import { apiFetch, CORE_BASE_URL, ApiException } from "@/lib/api/config";
import type {
	ArticleDetail,
	ArticleMedia,
	Insight,
	LocalMediaSummary,
	SetMediaKeepAllInput,
	SetMediaKeepInput,
} from "@vorynth/types";

/**
 * Reader + media API client.
 *
 * The article reader page reads one article (`GET /articles/:id`) and its
 * media (`GET /articles/:id/media`). Media is streamed from the source URL by
 * default; the user can opt to keep an item locally via the keep endpoints.
 * The Media management page reads `GET /media/local` for the storage summary.
 */

export function fetchArticleDetail(id: string): Promise<ArticleDetail> {
	return apiFetch<ArticleDetail>(`/articles/${encodeURIComponent(id)}`);
}

/**
 * Translate one story in place (v1.8.0) — title + body, into the user's
 * intelligence language. Returns the refreshed article (the reader re-renders
 * the translation and the Original toggle appears).
 *
 * `force` (Re-translate): skip the already-translated guard so a translation
 * that is detected as incomplete can be redone.
 */
export function translateArticle(
	id: string,
	opts?: { force?: boolean },
): Promise<ArticleDetail> {
	return apiFetch<ArticleDetail>(
		`/articles/${encodeURIComponent(id)}/translate`,
		{
			method: "POST",
			body: JSON.stringify({ force: opts?.force === true }),
		},
	);
}

/**
 * Per-story Re-collect (v1.8.0) — re-fetch the origin, refresh the full text,
 * re-translate a stale/incomplete translation, and fill a missing AI insight
 * (the Re-collect button next to Save). Returns the refreshed article.
 */
export function recollectArticle(id: string): Promise<ArticleDetail> {
	return apiFetch<ArticleDetail>(
		`/articles/${encodeURIComponent(id)}/recollect`,
		{ method: "POST" },
	);
}

/**
 * Generate one story's AI insight on demand (v1.8.0) — the brief card's
 * "Generate" button for a story whose analysis hasn't run yet. Returns the
 * created Insight (the brief is then invalidated and re-renders with it).
 * 400 (INSIGHT_NO_CONTENT / INSIGHT_LLM_UNAVAILABLE) surfaces as ApiException.
 */
export function generateArticleInsight(id: string): Promise<Insight> {
	return apiFetch<Insight>(`/articles/${encodeURIComponent(id)}/insight`, {
		method: "POST",
	});
}

export function fetchArticleMedia(id: string): Promise<ArticleMedia[]> {
	return apiFetch<ArticleMedia[]>(`/articles/${encodeURIComponent(id)}/media`);
}

export function setMediaKeep(
	articleId: string,
	input: SetMediaKeepInput,
): Promise<ArticleMedia | null> {
	return apiFetch<ArticleMedia | null>(
		`/articles/${encodeURIComponent(articleId)}/media/keep`,
		{ method: "POST", body: JSON.stringify(input) },
	);
}

export function setMediaKeepAll(
	articleId: string,
	input: SetMediaKeepAllInput,
): Promise<ArticleMedia[]> {
	return apiFetch<ArticleMedia[]>(
		`/articles/${encodeURIComponent(articleId)}/media/keep-all`,
		{ method: "POST", body: JSON.stringify(input) },
	);
}

export function releaseArticleMedia(
	articleId: string,
): Promise<{ released: number }> {
	return apiFetch<{ released: number }>(
		`/articles/${encodeURIComponent(articleId)}/media`,
		{ method: "DELETE" },
	);
}

export function fetchLocalMediaSummary(): Promise<LocalMediaSummary> {
	return apiFetch<LocalMediaSummary>(`/media/local`);
}

/**
 * Fetch a locally-kept media item's bytes as a Blob (v1.8.0). This uses a raw
 * fetch — the endpoint streams binary data, and `apiFetch` only speaks JSON.
 * The Media page draws the copyright attribution into images before saving.
 */
export async function fetchLocalMediaFile(itemId: string): Promise<Blob> {
	const res = await fetch(
		`${CORE_BASE_URL}/media/local/${encodeURIComponent(itemId)}/file`,
	);
	if (!res.ok) {
		throw new ApiException(
			res.status,
			`media file ${itemId} could not be downloaded`,
		);
	}
	return res.blob();
}

export function purgeLocalMedia(): Promise<{ purged: number }> {
	return apiFetch<{ purged: number }>(`/media/local`, { method: "DELETE" });
}
