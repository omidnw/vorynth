import { RateLimiter } from "../../src/modules/llm/rate-limiter.js";

/**
 * LLM rate limiting (project-details.md §24). The limiter paces requests at
 * an even interval instead of the old sliding window (which allowed a burst of
 * 5 calls then forced the 6th to wait ~55s for the oldest slot to age out).
 * These tests prove: the first call after an idle gap is immediate, subsequent
 * calls are spaced evenly, and the interval derives from the per-minute budget
 * (or a direct spacing override).
 */

function withEnv(
	env: Record<string, string | undefined>,
	fn: () => void | Promise<void>,
): Promise<void> | void {
	const prev: Record<string, string | undefined> = {};
	for (const [k, v] of Object.entries(env)) {
		prev[k] = process.env[k];
		if (v === undefined) delete process.env[k];
		else process.env[k] = v;
	}
	try {
		return fn();
	} finally {
		for (const [k, v] of Object.entries(prev)) {
			if (v === undefined) delete process.env[k];
			else process.env[k] = v;
		}
	}
}

describe("RateLimiter", () => {
	afterEach(() => {
		jest.useRealTimers();
	});

	it("lets the first call through immediately after an idle gap", async () => {
		// Fake timers make the timing assertions immune to parallel-run jitter:
		// real `sleep()` overshoots under CPU contention, which made the old
		// wall-clock deltas flaky (a late sleep lets the next slot age out, and
		// the next call legitimately goes through immediately).
		jest.useFakeTimers();
		await withEnv({ VORYNTH_LLM_SPACING_MS: "120" }, async () => {
			const limiter = new RateLimiter();
			const t0 = Date.now();
			await limiter.acquire("test");
			// No timer is scheduled for the first call — it starts at fake time 0.
			expect(Date.now() - t0).toBe(0);
		});
	});

	it("spaces consecutive calls evenly instead of bursting", async () => {
		jest.useFakeTimers();
		await withEnv({ VORYNTH_LLM_SPACING_MS: "60" }, async () => {
			const limiter = new RateLimiter();
			const t0 = Date.now();

			// First call immediate; the next slot opens at fake time 60.
			await limiter.acquire("test");
			const t1 = Date.now();
			expect(t1 - t0).toBe(0);

			// Second call sleeps until its slot opens exactly 60ms after the first.
			const second = limiter.acquire("test");
			jest.advanceTimersByTime(60);
			await second;
			const t2 = Date.now();
			expect(t2 - t1).toBe(60);

			// Third call likewise, on the next slot.
			const third = limiter.acquire("test");
			jest.advanceTimersByTime(60);
			await third;
			const t3 = Date.now();
			expect(t3 - t2).toBe(60);

			// Three calls across two full intervals — a steady cadence, not a burst.
			expect(t3 - t0).toBe(120);
		});
	});

	it("derives the interval from the per-minute budget", () => {
		return withEnv({ VORYNTH_LLM_RPM: "10" }, () => {
			const limiter = new RateLimiter();
			expect(limiter.spacingMs).toBe(6000);
			expect(limiter.capacity).toBe(10);
		});
	});

	it("lets a direct spacing override win over the RPM budget", () => {
		return withEnv(
			{ VORYNTH_LLM_RPM: "60", VORYNTH_LLM_SPACING_MS: "5000" },
			() => {
				const limiter = new RateLimiter();
				expect(limiter.spacingMs).toBe(5000);
				expect(limiter.capacity).toBe(12);
			},
		);
	});

	it("defaults to 5 req/min when no env is set", () => {
		return withEnv(
			{ VORYNTH_LLM_RPM: undefined, VORYNTH_LLM_SPACING_MS: undefined },
			() => {
				const limiter = new RateLimiter();
				expect(limiter.spacingMs).toBe(12_000);
				expect(limiter.capacity).toBe(5);
			},
		);
	});
});
