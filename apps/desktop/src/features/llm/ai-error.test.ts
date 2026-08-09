import { describe, expect, it } from "vitest";
import type { TFunction } from "i18next";
import { ApiException } from "@/lib/api/config";
import {
	LLM_ERROR_CODE_TO_KEY,
	aiErrorCode,
	aiErrorMessage,
} from "@/features/llm/ai-error.js";

/** t stub that returns the key itself — assertions check key selection. */
const t = ((key: string) => key) as TFunction;

describe("aiErrorCode", () => {
	it("returns the code from an ApiException", () => {
		const err = new ApiException(
			400,
			"rate limited",
			undefined,
			"LLM_RATE_LIMITED",
		);
		expect(aiErrorCode(err)).toBe("LLM_RATE_LIMITED");
	});

	it("returns null for an ApiException without a code", () => {
		const err = new ApiException(400, "boom");
		expect(aiErrorCode(err)).toBeNull();
	});

	it("treats a known code string as the code", () => {
		expect(aiErrorCode("LLM_AUTH_FAILED")).toBe("LLM_AUTH_FAILED");
	});

	it("returns null for an unknown plain string / arbitrary error", () => {
		expect(aiErrorCode("provider down")).toBeNull();
		expect(aiErrorCode(new Error("provider down"))).toBeNull();
		expect(aiErrorCode(null)).toBeNull();
		expect(aiErrorCode(undefined)).toBeNull();
	});
});

describe("aiErrorMessage — code → llmError key", () => {
	for (const [code, key] of Object.entries(LLM_ERROR_CODE_TO_KEY)) {
		it(`maps ${code} to ${key}`, () => {
			const err = new ApiException(400, "engine message", undefined, code);
			expect(aiErrorMessage(t, err, "article.translateFailed")).toBe(key);
		});
	}

	it("maps INSIGHT_LLM_UNAVAILABLE alongside LLM_NOT_CONFIGURED", () => {
		const err = new ApiException(
			400,
			"no llm",
			undefined,
			"INSIGHT_LLM_UNAVAILABLE",
		);
		expect(aiErrorMessage(t, err, "article.generateInsightFailed")).toBe(
			"llmError.notConfigured",
		);
	});

	it("maps a known code string surfaced as plain text (job errors)", () => {
		expect(
			aiErrorMessage(t, "LLM_KEY_MISSING", "article.translateFailed"),
		).toBe("llmError.keyMissing");
	});
});

describe("aiErrorMessage — unknown error → fallback key", () => {
	it("falls back for an ApiException with an unknown code", () => {
		const err = new ApiException(400, "weird", undefined, "SOME_OTHER_CODE");
		expect(aiErrorMessage(t, err, "article.translateFailed")).toBe(
			"article.translateFailed",
		);
	});

	it("falls back for a plain Error", () => {
		expect(
			aiErrorMessage(t, new Error("provider down"), "profile.generateFailed"),
		).toBe("profile.generateFailed");
	});

	it("falls back for a non-code string message", () => {
		expect(aiErrorMessage(t, "provider down", "profile.improveFailed")).toBe(
			"profile.improveFailed",
		);
	});

	it("falls back for null/undefined errors", () => {
		expect(aiErrorMessage(t, null, "article.recollectFailed")).toBe(
			"article.recollectFailed",
		);
		expect(aiErrorMessage(t, undefined, "article.recollectFailed")).toBe(
			"article.recollectFailed",
		);
	});
});
