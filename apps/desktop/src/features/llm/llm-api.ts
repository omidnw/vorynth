import { apiFetch } from "@/lib/api/config";
import type { LlmProviderConfig, LlmProviderKind } from "@vorynth/types";

export type ProviderKeyStatus = "ok" | "missing" | "undecryptable";

export interface ProviderRow {
	id: string;
	kind: LlmProviderKind;
	label: string;
	apiKeyStored: boolean;
	/** Health of the stored key: decryptable, never set, or unreadable (lost salt). */
	keyStatus: ProviderKeyStatus;
	defaultModel: string | null;
	baseUrl: string | null;
	enabled: boolean;
}

export async function fetchProviders(): Promise<ProviderRow[]> {
	return apiFetch<ProviderRow[]>("/llm/providers");
}

export async function saveProvider(input: {
	id?: string;
	kind: LlmProviderKind;
	label: string;
	apiKey?: string;
	defaultModel?: string;
	baseUrl?: string;
	enabled?: boolean;
}): Promise<ProviderRow> {
	return apiFetch<ProviderRow>("/llm/providers", {
		method: "POST",
		body: JSON.stringify(input),
	});
}

export async function deleteProvider(id: string): Promise<void> {
	await apiFetch(`/llm/providers/${id}`, { method: "DELETE" });
}

export async function verifyProvider(): Promise<{
	ok: boolean;
	providerKind: string;
}> {
	return apiFetch<{ ok: boolean; providerKind: string }>("/llm/verify", {
		method: "POST",
		body: JSON.stringify({}),
	});
}

// ── Status ───────────────────────────────────────────────────────────────────

export interface LlmStatus {
	configured: boolean;
	providerKind: string | null;
	/** Live rate-limiter state from the engine (VORYNTH_LLM_RPM / SPACING_MS drive it). */
	rateLimit: { capacity: number; inFlight: number; spacingMs: number };
	/** Why the LLM isn't usable, when not configured. */
	unavailableReason?:
		"not-configured" | "key-missing" | "key-undecryptable" | null;
}

export async function fetchStatus(): Promise<LlmStatus> {
	return apiFetch<LlmStatus>("/llm/status");
}

// ── Mode ──────────────────────────────────────────────────────────────────────

export async function fetchMode(): Promise<{ mode: "intelligence" | "news" }> {
	return apiFetch<{ mode: "intelligence" | "news" }>("/llm/mode");
}

export async function setMode(
	mode: "intelligence" | "news",
): Promise<{ mode: "intelligence" | "news" }> {
	return apiFetch<{ mode: "intelligence" | "news" }>("/llm/mode", {
		method: "POST",
		body: JSON.stringify({ mode }),
	});
}

// ── Active provider ───────────────────────────────────────────────────────────

export async function activateProvider(
	id: string,
): Promise<{ activeProviderId: string }> {
	return apiFetch<{ activeProviderId: string }>(
		`/llm/providers/${encodeURIComponent(id)}/activate`,
		{ method: "POST" },
	);
}

export type { LlmProviderConfig };
