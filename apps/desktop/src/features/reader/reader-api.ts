import { apiFetch } from "@/lib/api/config";
import type {
	ArticleDetail,
	ArticleMedia,
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

export function purgeLocalMedia(): Promise<{ purged: number }> {
	return apiFetch<{ purged: number }>(`/media/local`, { method: "DELETE" });
}
