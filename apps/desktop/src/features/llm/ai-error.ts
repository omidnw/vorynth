import type { TFunction } from "i18next";
import { ApiException } from "@/lib/api/config";

/**
 * AI action failure explanations (v1.9.0).
 *
 * The engine returns HTTP 400s with a structured `{ code, message }` body for
 * LLM failures. Every AI-dependent surface routes the error through
 * `aiErrorMessage` so the user sees a localized "why" (`llmError.*` catalog)
 * instead of a raw engine message — and falls back to the action's existing
 * failure key when the code is unknown or absent.
 */

/** Engine LLM error code → localized `llmError.*` i18n key. */
export const LLM_ERROR_CODE_TO_KEY: Record<string, string> = {
	LLM_NOT_CONFIGURED: "llmError.notConfigured",
	INSIGHT_LLM_UNAVAILABLE: "llmError.notConfigured",
	LLM_KEY_MISSING: "llmError.keyMissing",
	LLM_KEY_UNDECRYPTABLE: "llmError.keyUndecryptable",
	LLM_AUTH_FAILED: "llmError.authFailed",
	LLM_RATE_LIMITED: "llmError.rateLimited",
	LLM_UNREACHABLE: "llmError.unreachable",
	LLM_ERROR: "llmError.error",
};

/**
 * The structured code when `error` carries one: an `ApiException` with a
 * `code`, or a string that IS a known code (job errors often surface the code
 * as plain text). Returns `null` otherwise.
 */
export function aiErrorCode(error: unknown): string | null {
	if (error instanceof ApiException) return error.code ?? null;
	if (typeof error === "string" && error in LLM_ERROR_CODE_TO_KEY) return error;
	return null;
}

/**
 * Localized explanation for an AI action failure: maps a known engine code to
 * its `llmError.*` message, otherwise falls back to `fallbackKey` (the
 * action's existing generic failure string).
 */
export function aiErrorMessage(
	t: TFunction,
	error: unknown,
	fallbackKey: string,
): string {
	const code = aiErrorCode(error);
	const key = code ? LLM_ERROR_CODE_TO_KEY[code] : undefined;
	return key ? t(key) : t(fallbackKey);
}
