import { invoke } from "@tauri-apps/api/core";
import { check, type DownloadEvent } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { isTauriShell } from "@/features/plugins/plugins-folder.js";

/**
 * Auto-updater (v1.8.0) — thin wrapper over `tauri-plugin-updater`.
 *
 * The Rust plugin reads `latest.json` from the GitHub release
 * (https://github.com/omidnw/vorynth/releases/latest/download/latest.json),
 * compares its version against the running app, and — once the user approves —
 * downloads the signed artifact, verifies the minisign signature, then hands
 * the actual install to a DETACHED updater process: it waits for this app to
 * exit, replaces the install, relaunches Vorynth, and cleans up the downloaded
 * file. Nothing here talks to the engine — updates are a shell concern.
 *
 * Dev builds (`tauri dev`) can't self-replace, so install is only offered in
 * the packaged app; the check itself still works in dev (it reports "no
 * update" while 1.8.0 is newer than the latest public release — the negative
 * path).
 */

export type UpdateProgress =
	| { kind: "started"; totalBytes?: number }
	| { kind: "progress"; chunkBytes: number }
	| { kind: "finished" };

export interface AvailableUpdate {
	/** The newer version string, e.g. "1.8.1". */
	version: string;
	/**
	 * Download (with progress callbacks) + install via the detached updater
	 * process, then relaunch the app. Resolves when the relaunch has started.
	 */
	downloadAndInstall(onProgress: (p: UpdateProgress) => void): Promise<void>;
}

/** True inside the packaged (release) Tauri shell — the only place install works. */
export async function isPackagedBuild(): Promise<boolean> {
	if (!isTauriShell()) return false;
	try {
		return await invoke<boolean>("app_packaged");
	} catch {
		return false;
	}
}

/** Size of the installed app (the `.app` bundle / install dir), bytes. */
export async function appInstallSize(): Promise<number | null> {
	if (!isTauriShell()) return null;
	try {
		return await invoke<number | null>("app_install_size");
	} catch {
		return null;
	}
}

/**
 * Check GitHub releases for a newer Vorynth. Returns null when the running
 * version is up to date (or the check can't run — browser/plain dev).
 *
 * A release whose GitHub asset list has no `latest.json` yet (nothing signed
 * published — e.g. before the first auto-updatable release ships) is reported
 * by the plugin as "Could not fetch a valid release JSON from the remote". That
 * is not an error the user can act on — it means no update manifest exists — so
 * it maps to "up to date" rather than a scary failure banner.
 */
export async function checkForUpdate(): Promise<AvailableUpdate | null> {
	if (!isTauriShell()) return null;
	try {
		const update = await check();
		if (!update) return null;
		return {
			version: update.version,
			async downloadAndInstall(onProgress) {
				await update.downloadAndInstall((event) => {
					onProgress(mapDownloadEvent(event));
				});
				// Windows auto-exits during install; elsewhere relaunch restarts the
				// freshly-updated app (the updater process has already finished).
				await relaunch();
			},
		};
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		if (message.includes("valid release JSON from the remote")) {
			return null;
		}
		throw err;
	}
}

function mapDownloadEvent(event: DownloadEvent): UpdateProgress {
	switch (event.event) {
		case "Started":
			return { kind: "started", totalBytes: event.data.contentLength };
		case "Progress":
			return { kind: "progress", chunkBytes: event.data.chunkLength };
		case "Finished":
			return { kind: "finished" };
	}
}
