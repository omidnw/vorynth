import { apiFetch } from "@/lib/api/config";
import type { LlmProviderConfig, LlmProviderKind } from "@vorynth/types";

export interface ProviderRow {
	id: string;
	kind: LlmProviderKind;
	label: string;
	apiKeyStored: boolean;
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

export type { LlmProviderConfig };
