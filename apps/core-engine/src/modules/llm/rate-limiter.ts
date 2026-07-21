import { Injectable, Logger } from "@nestjs/common";

/**
 * Sliding-window rate limiter for LLM calls.
 *
 * Caps the number of calls per minute (default 5) to stay safely under
 * typical free-tier RPM limits. When the budget is exhausted, `acquire()`
 * resolves AFTER waiting until the next slot frees up — callers block, they
 * never get rate-limit errors from the provider. This keeps the queue moving
 * at exactly the configured pace.
 *
 * The limiter is global (one provider = one queue), so even when multiple
 * parts of the app ask for analysis at the same time (e.g. a Brief run and a
 * summary), they share the budget and don't blow past the limit.
 */
@Injectable()
export class RateLimiter {
	private readonly logger = new Logger("RateLimiter");
	/** Timestamps (ms) of recently-acquired slots, newest at the end. */
	private readonly timestamps: number[] = [];
	private readonly maxPerMinute: number;
	private readonly windowMs = 60_000;

	constructor() {
		// Override via env so tests/dev can crank it.
		this.maxPerMinute = Number(process.env.VORYNTH_LLM_RPM ?? 5);
	}

	/**
	 * Wait until a slot is available, then record it. Resolves immediately if
	 * we're under the limit; otherwise waits the minimum time for the oldest
	 * in-window slot to age out.
	 */
	async acquire(operation: string): Promise<void> {
		while (true) {
			const now = Date.now();
			// Drop timestamps outside the 1-minute window.
			while (
				this.timestamps.length > 0 &&
				now - (this.timestamps[0] ?? 0) > this.windowMs
			) {
				this.timestamps.shift();
			}

			if (this.timestamps.length < this.maxPerMinute) {
				this.timestamps.push(now);
				return;
			}

			// Compute how long until the oldest slot ages out.
			const oldest = this.timestamps[0] ?? now;
			const waitMs = this.windowMs - (now - oldest) + 10; // +10ms grace
			this.logger.debug(
				`rate limit hit (${operation}); waiting ${waitMs}ms for a slot`,
			);
			await sleep(waitMs);
		}
	}

	/** Current slots used in the rolling minute (0..maxPerMinute). */
	get inFlight(): number {
		const now = Date.now();
		while (
			this.timestamps.length > 0 &&
			now - (this.timestamps[0] ?? 0) > this.windowMs
		) {
			this.timestamps.shift();
		}
		return this.timestamps.length;
	}

	get capacity(): number {
		return this.maxPerMinute;
	}
}

function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}
