import { apiFetch } from "@/lib/api/config";
import type { BriefPeriod, Job, JobKind, JobList } from "@vorynth/types";

export async function fetchJobs(): Promise<JobList> {
	return apiFetch<JobList>("/jobs");
}

export async function fetchJob(id: string): Promise<Job | { notFound: true }> {
	return apiFetch<Job | { notFound: true }>(`/jobs/${id}`);
}

export async function startCollectJob(opts?: {
	force?: boolean;
}): Promise<Job> {
	const body: Record<string, unknown> = {};
	if (opts?.force) body.force = true;
	return apiFetch<Job>("/jobs/collect", {
		method: "POST",
		body: JSON.stringify(body),
	});
}

export async function startGenerateJob(
	opts: {
		period?: BriefPeriod;
		cap?: number;
		targetLanguage?: string;
	} = {},
): Promise<Job> {
	return apiFetch<Job>("/jobs/generate", {
		method: "POST",
		body: JSON.stringify(opts),
	});
}

export async function startSummarizeJob(
	opts: {
		period?: BriefPeriod;
		targetLanguage?: string;
		limit?: number;
	} = {},
): Promise<Job> {
	return apiFetch<Job>("/jobs/summarize", {
		method: "POST",
		body: JSON.stringify(opts),
	});
}

export async function startAskJob(
	q: string,
	opts: { periodDays?: number; budget?: number } = {},
): Promise<Job> {
	const params = new URLSearchParams({ q });
	return apiFetch<Job>(`/jobs/ask?${params}`, {
		method: "POST",
		body: JSON.stringify(opts),
	});
}

export async function cancelJob(
	id: string,
): Promise<{ id: string; canceled: boolean }> {
	return apiFetch<{ id: string; canceled: boolean }>(`/jobs/${id}/cancel`, {
		method: "POST",
		body: JSON.stringify({}),
	});
}

export async function startRegenerateInsightsJob(
	opts: { targetLanguage?: string } = {},
): Promise<Job> {
	return apiFetch<Job>("/jobs/regenerate-insights", {
		method: "POST",
		body: JSON.stringify(opts),
	});
}

export async function startTranslateStoriesJob(
	opts: { targetLanguage?: string; retranslateAll?: boolean } = {},
): Promise<Job> {
	return apiFetch<Job>("/jobs/translate-stories", {
		method: "POST",
		body: JSON.stringify(opts),
	});
}

/** Data health check (v1.8.0) — full text + translation repair + insights. */
export async function startHealthCheckJob(): Promise<Job> {
	return apiFetch<Job>("/jobs/health-check", {
		method: "POST",
		body: JSON.stringify({}),
	});
}

/** v1.8.0 — per-story Re-translate as a visible background job. */
export async function startTranslateOneJob(opts: {
	articleId: string;
	force?: boolean;
}): Promise<Job> {
	return apiFetch<Job>("/jobs/translate-one", {
		method: "POST",
		body: JSON.stringify(opts),
	});
}

/** v1.8.0 — per-story Re-collect as a visible background job. */
export async function startRecollectOneJob(opts: {
	articleId: string;
}): Promise<Job> {
	return apiFetch<Job>("/jobs/recollect-one", {
		method: "POST",
		body: JSON.stringify(opts),
	});
}

/** True when any job of the given kind is currently active. */
export function isActive(jobs: JobList | undefined, kind: JobKind): boolean {
	return Boolean(jobs?.active.some((j) => j.kind === kind));
}
