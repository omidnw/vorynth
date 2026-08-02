import { apiFetch } from "@/lib/api/config";
import type {
	EmptyTrashInput,
	PurgeTrashInput,
	RestoreTrashInput,
	TrashList,
} from "@vorynth/types";

/** GET /trash — unified list (trashed collections + history). */
export async function fetchTrash(): Promise<TrashList> {
	return apiFetch<TrashList>("/trash");
}

/** POST /trash/restore — back to the live view, exactly as it was. */
export async function restoreTrashEntry(
	input: RestoreTrashInput,
): Promise<{ restored: boolean }> {
	return apiFetch<{ restored: boolean }>("/trash/restore", {
		method: "POST",
		body: JSON.stringify(input),
	});
}

/** POST /trash/purge — permanent delete. 409 when saved items need `force`. */
export async function purgeTrashEntry(
	input: PurgeTrashInput,
): Promise<{ removed: number }> {
	return apiFetch<{ removed: number }>("/trash/purge", {
		method: "POST",
		body: JSON.stringify(input),
	});
}

/** POST /trash/empty — permanently delete everything in the trash. */
export async function emptyTrash(
	input?: EmptyTrashInput,
): Promise<{ removed: number }> {
	return apiFetch<{ removed: number }>("/trash/empty", {
		method: "POST",
		body: JSON.stringify(input ?? {}),
	});
}
