import { apiFetch } from "@/lib/api/config";
import type {
	BriefPeriod,
	EngineStatus,
	PeriodSummary,
	TodaysBrief,
} from "@vorynth/types";

/**
 * Brief API hooks.
 *
 * Thin wrappers over the Core Engine endpoints. The frontend holds NO business
 * logic — these just call the engine and let TanStack Query cache the result.
 */

export async function fetchTodaysBrief(): Promise<TodaysBrief> {
	return apiFetch<TodaysBrief>("/reports/today");
}

/** Ranked news feed scoped to a time period. */
export async function fetchRange(period: BriefPeriod): Promise<TodaysBrief> {
	return apiFetch<TodaysBrief>(`/reports/range?period=${period}`);
}

/** Fetch the bare ranked news feed (no LLM involvement). */
export async function fetchBrief(limit = 30, period: BriefPeriod = "all") {
	return apiFetch<TodaysBrief>(`/brief?limit=${limit}&period=${period}`);
}

/** Trigger collection from all enabled sources. */
export async function collectAllSources(): Promise<{
	sources: number;
	totalCollected: number;
}> {
	return apiFetch<{ sources: number; totalCollected: number }>(
		"/crawl/sources",
		{
			method: "POST",
			body: JSON.stringify({}),
		},
	);
}

/** Run the LangGraph pipeline and persist a fresh brief. */
export async function generateBrief(
	opts: {
		targetLanguage?: string;
		cap?: number;
		period?: BriefPeriod;
	} = {},
): Promise<TodaysBrief> {
	return apiFetch<TodaysBrief>("/reports/generate", {
		method: "POST",
		body: JSON.stringify(opts),
	});
}

/**
 * Ask the LLM to write ONE cohesive briefing over a time period.
 * Returns null in news mode (no LLM provider configured).
 */
export async function summarizePeriod(
	opts: {
		period?: BriefPeriod;
		targetLanguage?: string;
		limit?: number;
	} = {},
): Promise<PeriodSummary | { ok: false; reason: string }> {
	const qs = opts.period ? `?period=${opts.period}` : "";
	return apiFetch<PeriodSummary | { ok: false; reason: string }>(
		`/reports/summarize${qs}`,
		{
			method: "POST",
			body: JSON.stringify({
				targetLanguage: opts.targetLanguage,
				limit: opts.limit,
			}),
		},
	);
}

/** Verify a configured LLM provider is reachable (onboarding check). */
export async function verifyLlm(): Promise<{
	ok: boolean;
	providerKind: string;
}> {
	return apiFetch<{ ok: boolean; providerKind: string }>("/llm/verify", {
		method: "POST",
		body: JSON.stringify({}),
	});
}

/** Full engine status for onboarding / settings. */
export async function fetchEngineStatus(): Promise<EngineStatus> {
	return apiFetch<EngineStatus>("/status");
}
