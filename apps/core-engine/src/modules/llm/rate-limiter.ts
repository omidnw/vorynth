import { Injectable, Logger } from "@nestjs/common";

/**
 * Evenly-spaced rate limiter for LLM calls.
 *
 * Guarantees at least `intervalMs` between the *start* of consecutive calls —
 * a leaky bucket. The first call after an idle gap goes through immediately;
 * a burst of requests is serialized into a steady cadence instead of the old
 * sliding-window behavior (5 quick calls, then the 6th waits ~55s for the
 * oldest slot to age out).
 *
 * The interval comes from `VORYNTH_LLM_SPACING_MS` when set (direct control,
 * e.g. `5000` for 5s), otherwise it is derived from the per-minute budget
 * (`VORYNTH_LLM_RPM`, default 5 → 12s spacing). Raising RPM shortens the
 * delay — 12/min → 5s, 60/min → 1s — so the 1–10s band is reachable without
 * fighting the budget.
 *
 * The limiter is global (one provider = one queue), so even when multiple
 * parts of the app ask for analysis at the same time (a Brief run, a summary,
 * a regenerate batch) they share the cadence and never blow past the provider.
 */
@Injectable()
export class RateLimiter {
	private readonly logger = new Logger("RateLimiter");
	/** Earliest ms at which the next call may start. */
	private nextSlotAt = 0;
	/** Milliseconds between consecutive call starts. */
	private readonly intervalMs: number;
	/** Slot-start times (ms) of granted slots — kept for the `inFlight` view. */
	private readonly slots: number[] = [];
	private readonly windowMs = 60_000;

	constructor() {
		// Direct spacing wins; otherwise derive it from the per-minute budget.
		const spacingOverride = Number(process.env.VORYNTH_LLM_SPACING_MS);
		const rpm = Number(process.env.VORYNTH_LLM_RPM ?? 5);
		this.intervalMs =
			Number.isFinite(spacingOverride) && spacingOverride > 0
				? spacingOverride
				: 60_000 / (rpm > 0 ? rpm : 5);
	}

	/**
	 * Wait until the next slot, then return. Resolves immediately when we're
	 * outside the spacing window; otherwise sleeps just until the slot opens —
	 * callers block, they never get rate-limit errors from the provider.
	 */
	async acquire(operation: string): Promise<void> {
		const now = Date.now();
		const slot = Math.max(now, this.nextSlotAt);
		const waitMs = slot - now;
		if (waitMs > 0) {
			this.logger.debug(
				`rate limit hit (${operation}); waiting ${waitMs}ms for a slot (spacing ${this.intervalMs}ms)`,
			);
			await sleep(waitMs);
		}
		this.nextSlotAt = slot + this.intervalMs;
		// Record for the `inFlight` status view (slots granted in the rolling
		// minute) — display only, the pacing itself uses `nextSlotAt`.
		this.slots.push(slot);
		while (
			this.slots.length > 0 &&
			slot - (this.slots[0] ?? 0) > this.windowMs
		) {
			this.slots.shift();
		}
	}

	/** Slots granted in the rolling minute (0..capacity; display only). */
	get inFlight(): number {
		const now = Date.now();
		while (
			this.slots.length > 0 &&
			now - (this.slots[0] ?? 0) > this.windowMs
		) {
			this.slots.shift();
		}
		return this.slots.length;
	}

	/** Requests-per-minute budget the spacing was derived from (display only). */
	get capacity(): number {
		return Math.round(60_000 / this.intervalMs);
	}

	/** Milliseconds between consecutive call starts. */
	get spacingMs(): number {
		return this.intervalMs;
	}
}

function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}
