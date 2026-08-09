import { apiFetch, initCoreBaseUrl } from "@/lib/api/config";

export interface BackupInfo {
	name: string;
	path: string;
	sizeBytes: number;
	createdAt: string;
	/** `.vorynth-backup` = engine snapshot; `sqlite` = plain DB copy. */
	kind: "vorynth-backup" | "sqlite";
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

/**
 * Fetch a backup's bytes and save it to the OS Downloads folder — the
 * webview's anchor download (same mechanism as the theme exporter, v1.8.0).
 * The user owns the file once it's on disk; the engine copy stays untouched.
 */
export async function downloadBackup(name: string): Promise<void> {
	const base = await initCoreBaseUrl();
	const res = await fetch(`${base}/backup/${encodeURIComponent(name)}/file`);
	if (!res.ok) throw new Error(`download failed (HTTP ${res.status})`);
	const blob = await res.blob();
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = name;
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
}
