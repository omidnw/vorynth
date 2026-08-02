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
	it("lets the first call through immediately after an idle gap", () => {
		return withEnv({ VORYNTH_LLM_SPACING_MS: "120" }, async () => {
			const limiter = new RateLimiter();
			const t0 = Date.now();
			await limiter.acquire("test");
			expect(Date.now() - t0).toBeLessThan(50);
		});
	});

	it("spaces consecutive calls evenly instead of bursting", () => {
		return withEnv({ VORYNTH_LLM_SPACING_MS: "60" }, async () => {
			const limiter = new RateLimiter();
			const t0 = Date.now();
			await limiter.acquire("test");
			const t1 = Date.now();
			await limiter.acquire("test");
			const t2 = Date.now();
			await limiter.acquire("test");
			const t3 = Date.now();

			// First call immediate; the next two are spaced ~60ms apart.
			expect(t1 - t0).toBeLessThan(50);
			expect(t2 - t1).toBeGreaterThanOrEqual(50);
			expect(t3 - t2).toBeGreaterThanOrEqual(50);
			// Total wall time ≈ 2 intervals, not a burst.
			expect(t3 - t0).toBeGreaterThanOrEqual(110);
			expect(t3 - t0).toBeLessThan(1000);
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
