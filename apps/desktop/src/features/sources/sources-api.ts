import { apiFetch } from "@/lib/api/config";
import type {
	CreateSourceInput,
	Source,
	SourceArticlesResult,
	SourceRange,
	UpdateSourceInput,
} from "@vorynth/types";

export async function fetchSources(): Promise<Source[]> {
	return apiFetch<Source[]>("/sources");
}

export async function createSource(input: CreateSourceInput): Promise<Source> {
	return apiFetch<Source>("/sources", {
		method: "POST",
		body: JSON.stringify(input),
	});
}

/** Update any combination of name / enabled / fetchWindowDays / configuration. */
export async function updateSource(
	id: string,
	patch: UpdateSourceInput,
): Promise<Source> {
	return apiFetch<Source>(`/sources/${id}`, {
		method: "PATCH",
		body: JSON.stringify(patch),
	});
}

export async function toggleSource(
	id: string,
	enabled: boolean,
): Promise<Source> {
	return updateSource(id, { enabled });
}

/**
 * Delete a source. The engine REFUSES (409 BOOKMARKED_ARTICLES_EXIST) when the
 * source owns saved stories; `force` confirms the explicit "Delete anyway"
 * flow and also removes those bookmarks.
 */
export async function deleteSource(
	id: string,
	force = false,
): Promise<void> {
	await apiFetch<{ id: string; removed: boolean }>(
		`/sources/${id}${force ? "?force=true" : ""}`,
		{ method: "DELETE" },
	);
}

/** Articles within a time window for one source (v1.6.0 range windows). */
export async function fetchSourceArticles(
	id: string,
	opts: { range?: SourceRange; from?: string; to?: string } = {},
): Promise<SourceArticlesResult> {
	const qs = new URLSearchParams();
	if (opts.range) qs.set("range", opts.range);
	if (opts.from) qs.set("from", opts.from);
	if (opts.to) qs.set("to", opts.to);
	const q = qs.toString();
	return apiFetch<SourceArticlesResult>(
		`/sources/${id}/articles${q ? `?${q}` : ""}`,
	);
}
