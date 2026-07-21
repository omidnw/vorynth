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

/** True when any job of the given kind is currently active. */
export function isActive(jobs: JobList | undefined, kind: JobKind): boolean {
	return Boolean(jobs?.active.some((j) => j.kind === kind));
}
