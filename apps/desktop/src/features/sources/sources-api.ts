import { apiFetch } from "@/lib/api/config";
import type {
	BulkSourceEnableInput,
	CreateSourceInput,
	RefreshCatalogResult,
	Source,
	SourceArticlesResult,
	SourceGroupDimension,
	SourceListInfo,
	SourceRange,
	UpdateSourceInput,
	VerifySourceInput,
	VerifySourceResult,
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

/**
 * v1.8.0 — dry-run a source config without saving (the Add form's "Test"
 * button). The engine validates + fetches a few items and returns samples.
 */
export async function verifySource(
	input: VerifySourceInput,
): Promise<VerifySourceResult> {
	return apiFetch<VerifySourceResult>("/sources/verify", {
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
 * v1.8.0 — bulk enable/disable every source in a category/country/city/language
 * group (the Sources page group master switches).
 */
export async function enableSourceGroup(
	input: BulkSourceEnableInput,
): Promise<{ updated: number }> {
	return apiFetch<{ updated: number }>("/sources/bulk-enabled", {
		method: "POST",
		body: JSON.stringify(input),
	});
}

/** The group-by dimensions offered by the Sources page group selector. */
export const GROUP_DIMENSIONS: SourceGroupDimension[] = [
	"category",
	"country",
	"city",
	"language",
];

/**
 * Delete a source. The engine REFUSES (409 BOOKMARKED_ARTICLES_EXIST) when the
 * source owns saved stories; `force` confirms the explicit "Delete anyway"
 * flow and also removes those bookmarks.
 */
export async function deleteSource(id: string, force = false): Promise<void> {
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

// ── Source lists (v1.8.0) ───────────────────────────────────────────────────

/** Every curated list (official + community) with live source counts. */
export async function fetchSourceLists(): Promise<SourceListInfo[]> {
	return apiFetch<SourceListInfo[]>("/source-lists");
}

/** Turn a list on — its cached definitions materialize as sources. */
export async function enableSourceList(id: string): Promise<SourceListInfo> {
	return apiFetch<SourceListInfo>(`/source-lists/${id}/enable`, {
		method: "POST",
	});
}

/** Hide a list — nothing is deleted, sources and edits are kept. */
export async function disableSourceList(id: string): Promise<SourceListInfo> {
	return apiFetch<SourceListInfo>(`/source-lists/${id}/disable`, {
		method: "POST",
	});
}

/** Sync the community catalog from the GitHub repo (offline cache kept). */
export async function refreshSourceLists(): Promise<RefreshCatalogResult> {
	return apiFetch<RefreshCatalogResult>("/source-lists/refresh", {
		method: "POST",
	});
}

/**
 * v1.8.0 — import a source-list file (a `my-sources.json` export, or any
 * community-list file). The engine validates it exactly like a catalog file
 * and stores it as a local list; the returned list can then be enabled.
 */
export async function importSourceList(
	fileText: string,
): Promise<SourceListInfo> {
	return apiFetch<SourceListInfo>("/source-lists/import", {
		method: "POST",
		body: JSON.stringify({ file: fileText }),
	});
}
