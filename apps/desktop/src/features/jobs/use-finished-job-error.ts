import { useEffect, useRef, useState } from "react";
import { useJobsStore } from "./jobs-store.js";

/**
 * Track a started background job through the jobs store and surface its failure
 * (v1.9.0). `track` is called with the job's id when it starts; once the job
 * leaves the engine's active list, `error` carries its engine message when it
 * ended in `status === "error"`, else null (done / canceled clear it).
 *
 * Used by the Settings batch actions and the data-health check to explain why a
 * background AI job couldn't run, right next to the button that started it.
 */
export function useFinishedJobError() {
	const jobs = useJobsStore((s) => s.jobs);
	const [error, setError] = useState<string | null>(null);
	const jobIdRef = useRef<string | null>(null);

	useEffect(() => {
		const id = jobIdRef.current;
		if (!id) return;
		if (jobs.active.some((j) => j.id === id)) return;
		const finished = jobs.recent.find((j) => j.id === id);
		setError(finished?.status === "error" ? finished.error : null);
		jobIdRef.current = null;
	}, [jobs]);

	return {
		error,
		track: (id: string | null) => {
			jobIdRef.current = null;
			if (!id) {
				setError(null);
				return;
			}
			// The job may already be finished by the time the store's promise
			// resolves (e.g. it failed instantly) — catch that here; otherwise
			// the effect watches `jobs` until it leaves the active list. Test
			// mocks of the store may not expose `getState`; those fall back to
			// the effect-driven path.
			const jobs = useJobsStore.getState?.().jobs;
			if (jobs && !jobs.active.some((j) => j.id === id)) {
				const finished = jobs.recent.find((j) => j.id === id);
				setError(finished?.status === "error" ? finished.error : null);
				return;
			}
			jobIdRef.current = id;
			setError(null);
		},
	};
}
