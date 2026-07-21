import { create } from "zustand";
import type { BriefPeriod, Job, JobKind, JobList } from "@vorynth/types";
import {
	cancelJob,
	fetchJobs,
	startAskJob,
	startCollectJob,
	startGenerateJob,
	startSummarizeJob,
} from "./jobs-api.js";

/**
 * Global jobs store — persists across route changes.
 *
 * The store polls the engine every few seconds while any job is active, and
 * every 30s otherwise, so progress stays live no matter which page the user is
 * on. Starting a job is fire-and-forget: the user navigates away freely; the
 * job keeps running on the engine.
 *
 * The polling loop is started once by `<JobsTray>` on app mount. Other
 * components just call `startCollect()` / `startGenerate()` /
 * `startSummarize()` and read `active` to render their button states.
 */
interface StartGenerateOpts {
	period?: BriefPeriod;
	cap?: number;
	targetLanguage?: string;
}
interface StartSummarizeOpts {
	period?: BriefPeriod;
	targetLanguage?: string;
	limit?: number;
}

interface JobsState {
	jobs: JobList;
	polling: boolean;
	lastError: string | null;

	startPolling: () => void;
	stopPolling: () => void;
	refresh: () => Promise<void>;

	startCollect: () => Promise<Job | null>;
	startForceCollect: () => Promise<Job | null>;
	startGenerate: (opts?: StartGenerateOpts) => Promise<Job | null>;
	startSummarize: (opts?: StartSummarizeOpts) => Promise<Job | null>;
	startAsk: (
		q: string,
		opts?: { periodDays?: number; budget?: number },
	) => Promise<Job | null>;
	cancel: (id: string) => Promise<void>;

	/** True when any job of the given kind is currently active. */
	isActive: (kind: JobKind) => boolean;
}

let pollTimer: ReturnType<typeof setInterval> | null = null;

const empty: JobList = { active: [], recent: [] };

export const useJobsStore = create<JobsState>((set, get) => ({
	jobs: empty,
	polling: false,
	lastError: null,

	startPolling: () => {
		if (pollTimer) return;
		set({ polling: true });
		void get().refresh();
		// Adapt the poll interval: 2s while any job is active, 30s otherwise.
		const tick = async () => {
			await get().refresh();
			const hasActive = get().jobs.active.length > 0;
			if (pollTimer) clearInterval(pollTimer);
			pollTimer = setInterval(tick, hasActive ? 2_000 : 30_000);
		};
		pollTimer = setInterval(tick, 5_000);
	},

	stopPolling: () => {
		if (pollTimer) clearInterval(pollTimer);
		pollTimer = null;
		set({ polling: false });
	},

	refresh: async () => {
		try {
			const jobs = await fetchJobs();
			set({ jobs, lastError: null });
		} catch (err) {
			set({ lastError: (err as Error).message });
		}
	},

	startCollect: async () => {
		try {
			const job = await startCollectJob();
			await get().refresh();
			return job;
		} catch (err) {
			set({ lastError: (err as Error).message });
			return null;
		}
	},

	/** Force re-collect all sources — updates existing articles in place. */
	startForceCollect: async () => {
		try {
			const job = await startCollectJob({ force: true });
			await get().refresh();
			return job;
		} catch (err) {
			set({ lastError: (err as Error).message });
			return null;
		}
	},

	startGenerate: async (opts) => {
		try {
			const job = await startGenerateJob(opts ?? {});
			await get().refresh();
			return job;
		} catch (err) {
			set({ lastError: (err as Error).message });
			return null;
		}
	},

	startSummarize: async (opts) => {
		try {
			const job = await startSummarizeJob(opts ?? {});
			await get().refresh();
			return job;
		} catch (err) {
			set({ lastError: (err as Error).message });
			return null;
		}
	},

	startAsk: async (q, opts) => {
		try {
			const job = await startAskJob(q, opts);
			await get().refresh();
			return job;
		} catch (err) {
			set({ lastError: (err as Error).message });
			return null;
		}
	},

	cancel: async (id) => {
		await cancelJob(id);
		await get().refresh();
	},

	isActive: (kind) => get().jobs.active.some((j) => j.kind === kind),
}));

export type { StartGenerateOpts, StartSummarizeOpts };
