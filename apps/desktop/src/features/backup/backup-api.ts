import { apiFetch } from "@/lib/api/config";

export interface BackupInfo {
	name: string;
	path: string;
	sizeBytes: number;
	createdAt: string;
}

export async function exportBackup(): Promise<{
	path: string;
	sizeBytes: number;
	createdAt: string;
}> {
	return apiFetch("/backup/export", {
		method: "POST",
		body: JSON.stringify({}),
	});
}

export async function listBackups(): Promise<{ backups: BackupInfo[] }> {
	return apiFetch("/backup");
}

export async function restoreBackup(
	path: string,
): Promise<{ ok: boolean; message: string }> {
	return apiFetch("/backup/restore", {
		method: "POST",
		body: JSON.stringify({ path }),
	});
}

export async function deleteBackup(name: string): Promise<{ ok: boolean }> {
	return apiFetch(`/backup/${encodeURIComponent(name)}`, { method: "DELETE" });
}

export async function deleteAllData(): Promise<{
	ok: boolean;
	message: string;
}> {
	return apiFetch("/backup/delete-all", {
		method: "POST",
		body: JSON.stringify({}),
	});
}
