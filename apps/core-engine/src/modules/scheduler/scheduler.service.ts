import {
	Injectable,
	Logger,
	type OnModuleInit,
	type OnModuleDestroy,
} from "@nestjs/common";

/**
 * Minimal cron-style scheduler (project-details.md §31).
 *
 *   every 30 minutes  collect new articles from enabled sources
 *   once a day         generate the daily intelligence report
 *
 * Implemented with `setInterval` rather than pulling in a cron dependency —
 * good enough for the slice, and trivial to reason about. Each job is a
 * callback registered at construction; the scheduler owns its lifecycle.
 */
@Injectable()
export class SchedulerService implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger("Scheduler");
	private readonly handles = new Set<NodeJS.Timeout>();

	onModuleInit() {
		this.logger.log("scheduler started");
	}

	onModuleDestroy() {
		this.stopAll();
	}

	/** Register a job to run every `intervalMs`. Returns an unsubscribe. */
	every(
		intervalMs: number,
		name: string,
		job: () => Promise<void>,
	): () => void {
		// Run once shortly after boot, then on the interval.
		const initial = setTimeout(() => {
			this.run(name, job);
		}, 5_000);
		const recurring = setInterval(() => {
			this.run(name, job);
		}, intervalMs);
		this.handles.add(initial);
		this.handles.add(recurring);

		this.logger.log(
			`registered "${name}" every ${Math.round(intervalMs / 60_000)}m`,
		);

		return () => {
			clearTimeout(initial);
			clearInterval(recurring);
			this.handles.delete(initial);
			this.handles.delete(recurring);
		};
	}

	/** Register a job to run once a day at `hourUTC`. */
	dailyAt(hourUTC: number, name: string, job: () => Promise<void>): () => void {
		const intervalMs = msUntilNext(hourUTC);
		const initial = setTimeout(() => {
			this.run(name, job);
			// After the first run, reschedule daily.
			this.dailyAt(hourUTC, name, job);
		}, intervalMs);
		this.handles.add(initial);
		this.logger.log(
			`registered "${name}" daily at ${hourUTC.toString().padStart(2, "0")}:00 UTC`,
		);
		return () => {
			clearTimeout(initial);
			this.handles.delete(initial);
		};
	}

	private async run(name: string, job: () => Promise<void>) {
		const start = Date.now();
		try {
			await job();
			this.logger.log(`"${name}" completed in ${Date.now() - start}ms`);
		} catch (err) {
			this.logger.error(`"${name}" failed: ${(err as Error).message}`);
		}
	}

	private stopAll() {
		for (const h of this.handles) clearTimeout(h);
		this.handles.clear();
		this.logger.log("scheduler stopped");
	}
}

function msUntilNext(hourUTC: number): number {
	const now = new Date();
	const next = new Date(now);
	next.setUTCHours(hourUTC, 0, 0, 0);
	if (next.getTime() <= now.getTime()) {
		next.setUTCDate(next.getUTCDate() + 1);
	}
	return next.getTime() - now.getTime();
}
