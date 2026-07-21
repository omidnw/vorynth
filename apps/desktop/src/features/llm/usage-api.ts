import { apiFetch } from "@/lib/api/config";
import type { UsageSummary } from "@vorynth/types";

export async function fetchUsage(): Promise<UsageSummary> {
	return apiFetch<UsageSummary>("/llm/usage");
}

export async function resetUsage(): Promise<void> {
	await apiFetch<{ ok: boolean }>("/llm/usage", { method: "DELETE" });
}
