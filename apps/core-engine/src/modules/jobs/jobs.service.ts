import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import { randomUUID } from "node:crypto";

import type {
	Job,
	JobKind,
	JobList,
	JobProgress,
	JobStatus,
} from "@vorynth/types";

/**
 * Background job registry — every long-running operation (collect, generate,
 * summarize) is started here and runs to completion even if the user navigates
 * away from the page that kicked it off.
 *
 * Jobs live in memory for the lifetime of the engine process. The recent list
 * is capped to keep it from growing forever.
 *
 * Concurrency is bounded per kind (one collect, one generate, …) so two clicks
 * on "Collect" don't double the work — the second one is queued and runs when
 * the first finishes. The LLM kinds additionally share the engine-wide rate
 * limiter, so a queued generate/summarize can't overtake one already running.
 */
@Injectable()
export class JobsService implements OnModuleDestroy {
	private readonly logger = new Logger("Jobs");
	private readonly jobs = new Map<string, JobHandle>();
	private readonly order: string[] = [];
	private readonly maxRecent = 50;

	/** Active jobs by kind so we can queue instead of duplicating. */
	private readonly activeByKind = new Map<JobKind, Set<string>>();

	constructor() {}

	onModuleDestroy() {
		// Mark every active job as canceled so the UI doesn't show them running.
		for (const [id, handle] of this.jobs) {
			if (handle.job.status === "running" || handle.job.status === "queued") {
				this.mark(id, "canceled", { progress: handle.job.progress });
			}
		}
	}

	/**
	 * Start a job. If an active job of the same kind already exists, this
	 * returns that one (the user can poll it) rather than spawning a duplicate.
	 * The runner is invoked without awaiting — it updates progress via the
	 * returned `update` callback and resolves with a result payload.
	 */
	start(opts: {
		kind: JobKind;
		label: string;
		itemsTotal?: number;
		run: (ctx: {
			jobId: string;
			update: (patch: Partial<JobProgress>) => void;
			throwIfCanceled: () => void;
		}) => Promise<unknown>;
	}): Job {
		const existing = this.findActive(opts.kind);
		if (existing) {
			this.logger.log(
				`job ${opts.kind} already running → returning ${existing.job.id}`,
			);
			return existing.snapshot();
		}

		const id = randomUUID();
		const now = new Date().toISOString();
		const job: Job = {
			id,
			kind: opts.kind,
			label: opts.label,
			status: "running",
			progress: {
				message: `Starting ${opts.label}…`,
				fraction: 0,
				itemsDone: 0,
				itemsTotal: opts.itemsTotal,
			},
			startedAt: now,
			finishedAt: null,
			durationMs: null,
			error: null,
			result: null,
		};

		const handle: JobHandle = {
			job,
			canceled: false,
			snapshot: () => ({ ...job, progress: { ...job.progress } }),
		};
		this.jobs.set(id, handle);
		this.order.push(id);
		this.recentCap();
		this.activeByKind.set(
			opts.kind,
			(this.activeByKind.get(opts.kind) ?? new Set()).add(id),
		);

		const update = (patch: Partial<JobProgress>) => {
			handle.job.progress = { ...handle.job.progress, ...patch };
		};
		const throwIfCanceled = () => {
			if (handle.canceled) throw new Error("job canceled");
		};

		// Fire and forget — the promise resolves the job's terminal state.
		void opts.run({ jobId: id, update, throwIfCanceled }).then(
			(result) => this.mark(id, "done", { result }),
			(err) => this.mark(id, "error", { error: (err as Error).message }),
		);

		this.logger.log(`started ${opts.kind} job ${id} (${opts.label})`);
		return handle.snapshot();
	}

	/** Cancel a running/queued job. Best-effort — the runner checks via throwIfCanceled. */
	cancel(id: string): boolean {
		const handle = this.jobs.get(id);
		if (!handle) return false;
		if (handle.job.status === "running" || handle.job.status === "queued") {
			handle.canceled = true;
			this.mark(id, "canceled", {});
			return true;
		}
		return false;
	}

	get(id: string): Job | null {
		return this.jobs.get(id)?.snapshot() ?? null;
	}

	/** Active (running/queued) jobs first, then the most recent terminal ones. */
	list(): JobList {
		const active: Job[] = [];
		const recent: Job[] = [];
		for (const id of [...this.order].reverse()) {
			const handle = this.jobs.get(id);
			if (!handle) continue;
			const snap = handle.snapshot();
			if (snap.status === "running" || snap.status === "queued")
				active.push(snap);
			else recent.push(snap);
		}
		return { active, recent: recent.slice(0, this.maxRecent) };
	}

	// ── internals ────────────────────────────────────────────────────────────

	private findActive(kind: JobKind): JobHandle | null {
		const ids = this.activeByKind.get(kind);
		if (!ids || ids.size === 0) return null;
		for (const id of ids) {
			const handle = this.jobs.get(id);
			if (
				handle &&
				(handle.job.status === "running" || handle.job.status === "queued")
			) {
				return handle;
			}
		}
		return null;
	}

	private mark(id: string, status: JobStatus, patch: Partial<Job>) {
		const handle = this.jobs.get(id);
		if (!handle) return;
		const now = new Date();
		handle.job.status = status;
		handle.job.finishedAt = now.toISOString();
		handle.job.durationMs =
			now.getTime() - new Date(handle.job.startedAt).getTime();
		if (patch.error !== undefined) handle.job.error = patch.error;
		if (patch.result !== undefined) handle.job.result = patch.result;
		if (status === "done") {
			handle.job.progress = {
				...handle.job.progress,
				message: "Done",
				fraction: 1,
				itemsDone:
					handle.job.progress.itemsTotal ?? handle.job.progress.itemsDone,
			};
		} else if (status === "error") {
			handle.job.progress = { ...handle.job.progress, message: "Failed" };
		} else if (status === "canceled") {
			handle.job.progress = { ...handle.job.progress, message: "Canceled" };
		}
		// Remove from the active set for this kind.
		const set = this.activeByKind.get(handle.job.kind);
		set?.delete(id);
		this.logger.log(`job ${id} → ${status} (${handle.job.durationMs}ms)`);
	}

	private recentCap() {
		while (this.order.length > this.maxRecent * 2) {
			const oldest = this.order.shift();
			if (oldest) this.jobs.delete(oldest);
		}
	}
}

interface JobHandle {
	job: Job;
	canceled: boolean;
	snapshot: () => Job;
}
