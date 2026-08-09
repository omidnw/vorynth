import { apiFetch } from "@/lib/api/config";
import { purgeLocalMedia } from "@/features/reader/reader-api.js";
import type { ClearStoriesResult, UsageStats } from "@vorynth/types";

/**
 * Storage & usage API client (v1.8.0) — the Settings "Storage & Usage" surface.
 *
 *   GET    /usage          full snapshot (libraries, stories, process, system)
 *   DELETE /stories        "clear all stories" (bookmarks + collections kept)
 *   DELETE /media/local    "clear media" (existing reader-api helper)
 */

export function fetchUsage(): Promise<UsageStats> {
	return apiFetch<UsageStats>(`/usage`);
}

export function clearStories(): Promise<ClearStoriesResult> {
	return apiFetch<ClearStoriesResult>(`/stories`, { method: "DELETE" });
}

export { purgeLocalMedia };
