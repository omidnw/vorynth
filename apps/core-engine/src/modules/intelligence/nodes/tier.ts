import type { ImportanceTier } from "@vorynth/types";

/**
 * Maps a 0–10 importance score to the badge tier used across the UI.
 *
 * Shared between the deterministic ranker (news mode, no LLM) and the
 * Analyzer node (LLM mode), so the tier vocabulary stays consistent.
 */
export function tierFor(score: number): ImportanceTier {
	if (score >= 7.5) return "signal";
	if (score >= 5) return "trend";
	return "low-noise";
}
