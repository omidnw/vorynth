import { apiFetch } from "@/lib/api/config";
import type {
	CreateSourceInput,
	Source,
	UpdateSourceInput,
} from "@vorynth/types";

export async function fetchSources(): Promise<Source[]> {
	return apiFetch<Source[]>("/sources");
}

export async function createSource(input: CreateSourceInput): Promise<Source> {
	return apiFetch<Source>("/sources", {
		method: "POST",
		body: JSON.stringify(input),
	});
}

/** Update any combination of name / enabled / fetchWindowDays / configuration. */
export async function updateSource(
	id: string,
	patch: UpdateSourceInput,
): Promise<Source> {
	return apiFetch<Source>(`/sources/${id}`, {
		method: "PATCH",
		body: JSON.stringify(patch),
	});
}

export async function toggleSource(
	id: string,
	enabled: boolean,
): Promise<Source> {
	return updateSource(id, { enabled });
}

export async function deleteSource(id: string): Promise<void> {
	await apiFetch<{ id: string; removed: boolean }>(`/sources/${id}`, {
		method: "DELETE",
	});
}
