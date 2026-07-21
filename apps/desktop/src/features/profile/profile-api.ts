import { apiFetch } from "@/lib/api/config";
import type {
	GenerateSummaryResult,
	ImproveInstructionResult,
	UpdateUserProfileInput,
	UserProfile,
} from "@vorynth/types";

/**
 * Profile API client.
 *
 * Reads/writes the single user-profile row and drives the two LLM-backed
 * operations: generate a behavior summary from history, and improve a rough
 * custom-instruction draft. Both record into generated history server-side.
 */

export function fetchProfile(): Promise<UserProfile> {
	return apiFetch<UserProfile>(`/profile`);
}

export function patchProfile(
	patch: UpdateUserProfileInput,
): Promise<UserProfile> {
	return apiFetch<UserProfile>(`/profile`, {
		method: "PATCH",
		body: JSON.stringify(patch),
	});
}

export function generateSummary(): Promise<GenerateSummaryResult> {
	return apiFetch<GenerateSummaryResult>(`/profile/generate-summary`, {
		method: "POST",
	});
}

export function improveInstruction(
	text: string,
): Promise<ImproveInstructionResult> {
	return apiFetch<ImproveInstructionResult>(`/profile/improve-instruction`, {
		method: "POST",
		body: JSON.stringify({ text }),
	});
}
