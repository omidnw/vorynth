import {
	Inject,
	Injectable,
	Logger,
	type OnModuleDestroy,
	type OnModuleInit,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";

import type {
	Job,
	JobKind,
	JobList,
	JobProgress,
	JobStatus,
} from "@vorynth/types";
import { DatabaseService } from "../../db/database.service.js";
import {
	getJobRunner,
	type JobRunnerDef,
} from "./jobs.runners.js";

/**
 * A raw `jobs` row as returned by better-sqlite3 — snake_case keys, exactly
 * the persisted columns (NOT the Drizzle `JobRow` camelCase shape).
 */
interface PersistedJobRow {
	id: string;
	kind: string;
	label: string;
	status: string;
	message: string;
	fraction: number;
	items_done: number | null;
	items_total: number | null;
	input_json: string | null;
	started_at: string;
	finished_at: string | null;
	duration_ms: number | null;
	error: string | null;
	result_json: string | null;
	updated_at: number;
}

/**
 * Background job registry — every long-running operation (collect, generate,
 * summarize, regenerate, translate) is started here and runs to completion
 * even if the user navigates away from the page that kicked it off.
 *
 * Jobs are persisted to the `jobs` table on every mutation, so a process
 * restart doesn't lose them: jobs that were running or queued are restored as
 * `queued` on boot and re-run from their last checkpoint (`resumeFrom`).
 *
 * Concurrency is bounded per kind: a second same-kind start is queued and
 * promoted when the running one finishes. The LLM kinds additionally share
 * the engine-wide rate limiter, so a queued generate/summarize can't overtake
 * one already running.
 */
@Injectable()
export class JobsService implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger("Jobs");
	private readonly jobs = new Map<string, JobHandle>();
	private readonly order: string[] = [];
	private readonly maxRecent = 50;
	private readonly activeByKind = new Map<JobKind, Set<string>>();
	private readonly raw: Database.Database;

	/** True while the engine is shutting down — in-flight runner resolutions
	 * must not keep writing to the DB (their rows were already flipped to
	 * "queued" so the next boot resumes them). */
	private shuttingDown = false;

	constructor(@Inject(DatabaseService) db: DatabaseService) {
		this.raw = db.rawDb;
	}

	onModuleInit() {
		// Restore jobs interrupted by a restart so they resume instead of
		// vanishing. Rows still "running"/"queued" in the DB come back as
		// "queued" and are re-run from their last checkpoint.
		const rows = this.raw
			.prepare(
				"SELECT * FROM jobs WHERE status IN ('running', 'queued') ORDER BY updated_at ASC",
			)
			.all() as PersistedJobRow[];
		for (const row of rows) {
			this.restoreFromRow(row);
		}
	}

	onModuleDestroy() {
		// Persist interrupted jobs as "queued" so they resume after a restart
		// (previously everything was marked canceled and lost). In-flight
		// runner resolutions are ignored via `shuttingDown`.
		this.shuttingDown = true;
		for (const [id, handle] of this.jobs) {
			if (handle.job.status === "running" || handle.job.status === "queued") {
				handle.job.status = "queued";
				handle.job.progress = {
					...handle.job.progress,
					message: "Interrupted by restart — resuming next launch",
				};
				this.raw
					.prepare(
						"UPDATE jobs SET status = 'queued', message = ?, updated_at = ? WHERE id = ?",
					)
					.run(handle.job.progress.message, Date.now(), id);
			}
		}
	}

	/**
	 * Start a job. When a job of the same kind is already running or queued,
	 * the new one is created as `queued` and promoted automatically when the
	 * current one reaches a terminal state — a job is always created and
	 * visible, never silently deduped.
	 */
	start(opts: { kind: JobKind; input?: unknown }): Job {
		const factory = getJobRunner(opts.kind);
		if (!factory) {
			throw new Error(`no job runner registered for kind "${opts.kind}"`);
		}
		const def = factory(opts.input);
		const existing = this.findActive(opts.kind);

		const id = randomUUID();
		const now = new Date().toISOString();
		const job: Job = {
			id,
			kind: opts.kind,
			label: def.label,
			status: existing ? "queued" : "running",
			progress: {
				message: existing
					? `Queued behind the current ${opts.kind} job…`
					: `Starting ${def.label}…`,
				fraction: 0,
				itemsDone: 0,
				itemsTotal: def.itemsTotal,
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
			input: opts.input ?? null,
			def,
			snapshot: () => ({ ...job, progress: { ...job.progress } }),
		};
		this.jobs.set(id, handle);
		this.order.push(id);
		this.recentCap();
		this.addActive(opts.kind, id);
		this.persist(id);

		if (existing) {
			this.logger.log(
				`job ${id} (${def.label}) queued behind ${existing.job.id}`,
			);
		} else {
			this.logger.log(`started ${opts.kind} job ${id} (${def.label})`);
			this.beginRun(handle);
		}
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

	/** Fire the runner for a (freshly promoted or restored) job. */
	private beginRun(handle: JobHandle): void {
		const id = handle.job.id;
		const update = (patch: Partial<JobProgress>) => {
			handle.job.progress = { ...handle.job.progress, ...patch };
			this.persist(id);
		};
		const throwIfCanceled = () => {
			if (handle.canceled) throw new Error("job canceled");
		};
		const resumeFrom = handle.job.progress.itemsDone ?? 0;

		handle.job.status = "running";
		if (resumeFrom > 0) {
			handle.job.progress = {
				...handle.job.progress,
				message: `Resuming ${handle.job.label}…`,
			};
		}
		this.persist(id);

		// Fire and forget — the promise resolves the job's terminal state. A
		// canceled job's late resolve never flips it back to "done".
		void handle.def.run({ jobId: id, update, throwIfCanceled, resumeFrom }).then(
			(result) => {
				if (handle.canceled) return;
				this.mark(id, "done", { result });
			},
			(err) => {
				if (handle.canceled) return;
				this.mark(id, "error", { error: (err as Error).message });
			},
		);
	}

	/** Rebuild a job from a persisted row after a restart and run it. */
	private restoreFromRow(row: PersistedJobRow): void {
		const factory = getJobRunner(row.kind as JobKind);
		if (!factory) {
			this.logger.warn(
				`job ${row.id}: no runner registered for kind "${row.kind}" — marking error`,
			);
			this.raw
				.prepare(
					"UPDATE jobs SET status = 'error', error = ?, finished_at = ?, updated_at = ? WHERE id = ?",
				)
				.run(
					`resume not supported: no runner for kind "${row.kind}"`,
					new Date().toISOString(),
					Date.now(),
					row.id,
				);
			return;
		}
		const input = row.input_json ? (JSON.parse(row.input_json) as unknown) : undefined;
		const def = factory(input);
		const job: Job = {
			id: row.id,
			kind: row.kind as JobKind,
			label: def.label,
			status: "queued",
			progress: {
				message: `Resuming ${def.label}…`,
				fraction: row.fraction ?? 0,
				itemsDone: row.items_done ?? 0,
				itemsTotal: row.items_total ?? undefined,
			},
			// Keep the original startedAt so duration reflects wall-clock time
			// across restarts.
			startedAt: row.started_at,
			finishedAt: null,
			durationMs: null,
			error: null,
			result: null,
		};
		const handle: JobHandle = {
			job,
			canceled: false,
			input: input ?? null,
			def,
			snapshot: () => ({ ...job, progress: { ...job.progress } }),
		};
		this.jobs.set(job.id, handle);
		this.order.push(job.id);
		this.recentCap();
		this.addActive(job.kind, job.id);
		this.persist(job.id);
		this.logger.log(`restored ${job.kind} job ${job.id} (${def.label}) as queued`);
		this.drain(job.kind);
	}

	/** Promote the oldest queued job of a kind once nothing is running. */
	private drain(kind: JobKind): void {
		if (this.findRunning(kind)) return;
		for (const id of this.order) {
			const handle = this.jobs.get(id);
			if (!handle || handle.job.kind !== kind || handle.job.status !== "queued")
				continue;
			if (handle.canceled) continue; // canceled queued job — skip, promote next
			this.logger.log(
				`promoting queued ${kind} job ${id} (${handle.job.label})`,
			);
			this.beginRun(handle);
			return;
		}
	}

	private persist(id: string): void {
		if (this.shuttingDown) return;
		const handle = this.jobs.get(id);
		if (!handle) return;
		const j = handle.job;
		this.raw
			.prepare(
				`INSERT INTO jobs (id, kind, label, status, message, fraction, items_done, items_total, input_json, started_at, finished_at, duration_ms, error, result_json, updated_at)
				 VALUES (@id, @kind, @label, @status, @message, @fraction, @items_done, @items_total, @input, @started_at, @finished_at, @duration_ms, @error, @result, @updated_at)
				 ON CONFLICT(id) DO UPDATE SET
					kind = excluded.kind,
					label = excluded.label,
					status = excluded.status,
					message = excluded.message,
					fraction = excluded.fraction,
					items_done = excluded.items_done,
					items_total = excluded.items_total,
					input_json = excluded.input_json,
					started_at = excluded.started_at,
					finished_at = excluded.finished_at,
					duration_ms = excluded.duration_ms,
					error = excluded.error,
					result_json = excluded.result_json,
					updated_at = excluded.updated_at`,
			)
			.run({
				id: j.id,
				kind: j.kind,
				label: j.label,
				status: j.status,
				message: j.progress.message ?? "",
				fraction: j.progress.fraction ?? 0,
				items_done: j.progress.itemsDone ?? null,
				items_total: j.progress.itemsTotal ?? null,
				input:
					handle.input === null || handle.input === undefined
						? null
						: JSON.stringify(handle.input),
				started_at: j.startedAt,
				finished_at: j.finishedAt,
				duration_ms: j.durationMs,
				error: j.error,
				result:
					j.result === null || j.result === undefined
						? null
						: JSON.stringify(j.result),
				updated_at: Date.now(),
			});
	}

	private mark(id: string, status: JobStatus, patch: Partial<Job>): void {
		// During shutdown the row was already flipped to "queued" for resume —
		// a late runner resolution must not touch the DB (it may be closed).
		if (this.shuttingDown) return;
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
		this.removeActive(handle.job.kind, id);
		this.persist(id);
		this.prune();
		this.logger.log(`job ${id} → ${status} (${handle.job.durationMs}ms)`);
		// A freed slot lets the next queued job of the same kind start.
		if (!this.shuttingDown) this.drain(handle.job.kind);
	}

	/** Drop terminal rows beyond the most recent 100 so the table stays tidy. */
	private prune(): void {
		const stale = this.raw
			.prepare(
				"SELECT id FROM jobs WHERE status IN ('done', 'error', 'canceled') ORDER BY updated_at DESC LIMIT -1 OFFSET 100",
			)
			.all() as Array<{ id: string }>;
		const del = this.raw.prepare("DELETE FROM jobs WHERE id = ?");
		for (const row of stale) del.run(row.id);
	}

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

	private findRunning(kind: JobKind): JobHandle | null {
		const ids = this.activeByKind.get(kind);
		if (!ids || ids.size === 0) return null;
		for (const id of ids) {
			const handle = this.jobs.get(id);
			if (handle && handle.job.status === "running" && !handle.canceled) {
				return handle;
			}
		}
		return null;
	}

	private addActive(kind: JobKind, id: string): void {
		const set = this.activeByKind.get(kind) ?? new Set<string>();
		set.add(id);
		this.activeByKind.set(kind, set);
	}

	private removeActive(kind: JobKind, id: string): void {
		this.activeByKind.get(kind)?.delete(id);
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
	/** Persisted runner input (what it takes to resume after a restart). */
	input: unknown;
	def: JobRunnerDef;
	snapshot: () => Job;
}
