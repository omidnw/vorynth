import type { JobKind, JobProgress } from "@vorynth/types";

/**
 * Context handed to a job's runner — the live view a runner mutates.
 */
export interface JobRunContext {
	jobId: string;
	/** Shallow-merge a patch into the job's progress (and persist it). */
	update: (patch: Partial<JobProgress>) => void;
	/** Throws "job canceled" once the user cancels the job (best-effort). */
	throwIfCanceled: () => void;
	/**
	 * How many items were already completed before a restart resumed this job.
	 * Runners that can checkpoint (regenerate) skip to here; runners that can't
	 * (generate, collect) restart from scratch but the job itself survives.
	 */
	resumeFrom: number;
}

export interface JobRunnerDef {
	label: string;
	itemsTotal?: number;
	run: (ctx: JobRunContext) => Promise<unknown>;
}

/**
 * A factory that rebuilds a job's runner from its persisted input after an
 * engine restart. `input` is whatever the controller received in the request
 * body (period, targetLanguage, force, …), stored as JSON on the jobs row.
 */
export type JobRunnerFactory = (input: unknown) => JobRunnerDef;

/**
 * Kind → factory registry.
 *
 * Lives at module level (not on the service) so both the controller — which
 * registers runners in its constructor — and JobsService — which resumes them
 * in `onModuleInit` — see the same table regardless of Nest lifecycle
 * ordering (all providers are constructed before any lifecycle hook runs).
 */
const registry = new Map<JobKind, JobRunnerFactory>();

export function registerJobRunner(
	kind: JobKind,
	factory: JobRunnerFactory,
): void {
	registry.set(kind, factory);
}

export function getJobRunner(kind: JobKind): JobRunnerFactory | undefined {
	return registry.get(kind);
}
