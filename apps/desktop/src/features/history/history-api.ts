import { apiFetch } from "@/lib/api/config";
import type {
	AppSettings,
	BriefHistoryEntry,
	BriefHistoryList,
	GeneratedHistoryEntry,
	GeneratedHistoryList,
	SearchHistoryEntry,
	SearchHistoryList,
	UpdateHistoryEntryInput,
} from "@vorynth/types";

// ── Search history ──────────────────────────────────────────────────────────

export function fetchSearchHistory(
	includeArchived = false,
): Promise<SearchHistoryList> {
	const qs = includeArchived ? "?includeArchived=true" : "";
	return apiFetch<SearchHistoryList>(`/history/search${qs}`);
}

export function fetchSearchEntry(
	id: string,
): Promise<SearchHistoryEntry | null> {
	return apiFetch<SearchHistoryEntry | null>(
		`/history/search/${encodeURIComponent(id)}`,
	);
}

export function patchSearchEntry(
	id: string,
	patch: UpdateHistoryEntryInput,
): Promise<SearchHistoryEntry | null> {
	return apiFetch<SearchHistoryEntry | null>(
		`/history/search/${encodeURIComponent(id)}`,
		{ method: "PATCH", body: JSON.stringify(patch) },
	);
}

export function deleteSearchEntries(
	ids: string[],
): Promise<{ removed: number }> {
	return apiFetch<{ removed: number }>(`/history/search`, {
		method: "DELETE",
		body: JSON.stringify({ ids }),
	});
}

// ── Brief history ───────────────────────────────────────────────────────────

export function fetchBriefHistory(
	includeArchived = false,
): Promise<BriefHistoryList> {
	const qs = includeArchived ? "?includeArchived=true" : "";
	return apiFetch<BriefHistoryList>(`/history/brief${qs}`);
}

export function fetchBriefEntry(id: string): Promise<BriefHistoryEntry | null> {
	return apiFetch<BriefHistoryEntry | null>(
		`/history/brief/${encodeURIComponent(id)}`,
	);
}

export function patchBriefEntry(
	id: string,
	patch: UpdateHistoryEntryInput,
): Promise<BriefHistoryEntry | null> {
	return apiFetch<BriefHistoryEntry | null>(
		`/history/brief/${encodeURIComponent(id)}`,
		{ method: "PATCH", body: JSON.stringify(patch) },
	);
}

export function deleteBriefEntries(
	ids: string[],
): Promise<{ removed: number }> {
	return apiFetch<{ removed: number }>(`/history/brief`, {
		method: "DELETE",
		body: JSON.stringify({ ids }),
	});
}

// ── Generated history (Profile LLM generations) ──────────────────────────────

export function fetchGeneratedHistory(
	includeArchived = false,
): Promise<GeneratedHistoryList> {
	const qs = includeArchived ? "?includeArchived=true" : "";
	return apiFetch<GeneratedHistoryList>(`/history/generated${qs}`);
}

export function fetchGeneratedEntry(
	id: string,
): Promise<GeneratedHistoryEntry | null> {
	return apiFetch<GeneratedHistoryEntry | null>(
		`/history/generated/${encodeURIComponent(id)}`,
	);
}

export function patchGeneratedEntry(
	id: string,
	patch: UpdateHistoryEntryInput,
): Promise<GeneratedHistoryEntry | null> {
	return apiFetch<GeneratedHistoryEntry | null>(
		`/history/generated/${encodeURIComponent(id)}`,
		{ method: "PATCH", body: JSON.stringify(patch) },
	);
}

export function deleteGeneratedEntries(
	ids: string[],
): Promise<{ removed: number }> {
	return apiFetch<{ removed: number }>(`/history/generated`, {
		method: "DELETE",
		body: JSON.stringify({ ids }),
	});
}

// ── App settings ────────────────────────────────────────────────────────────

export function fetchSettings(): Promise<AppSettings> {
	return apiFetch<AppSettings>(`/settings`);
}

export function patchSettings(
	patch: Partial<AppSettings>,
): Promise<AppSettings> {
	return apiFetch<AppSettings>(`/settings`, {
		method: "PATCH",
		body: JSON.stringify(patch),
	});
}
