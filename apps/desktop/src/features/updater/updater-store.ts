import { create } from "zustand";
import {
	checkForUpdate,
	isPackagedBuild,
	type AvailableUpdate,
	type UpdateProgress,
} from "./updater-api.js";

/**
 * Shared auto-update state (v1.8.0) — one store powers both the global
 * UpdateBanner and the Settings Updates section, so a check triggered from
 * either surface is reflected everywhere (and never runs twice at once).
 *
 * The check itself is a single GET against GitHub releases; it only runs in
 * the Tauri shell, and the full download/install/relaunch flow only when the
 * app is packaged (`tauri dev` can't self-replace).
 */

export type UpdaterPhase =
	| { kind: "idle" }
	| { kind: "checking" }
	| { kind: "uptodate" }
	| { kind: "available" }
	| { kind: "downloading"; percent: number | null }
	| { kind: "installing" }
	| { kind: "error"; message: string };

interface UpdaterStore {
	/** Phase of the current check/install flow. */
	phase: UpdaterPhase;
	/** True in the packaged (release) app — install is offered only there. */
	packaged: boolean;
	/** ISO timestamp of the last completed check. */
	lastChecked: string | null;
	/** The pending update (available phase), kept for the install action. */
	available: AvailableUpdate | null;

	/** Resolve `packaged`, then silently check once (called from the banner). */
	init: () => Promise<void>;
	/** Check GitHub releases for a newer version. No-op while checking. */
	check: () => Promise<void>;
	/** Download + install + relaunch (only when packaged). */
	install: () => Promise<void>;
	/** Dismiss the banner for this session. */
	dismiss: () => void;
}

let checking = false;

export const useUpdaterStore = create<UpdaterStore>((set, get) => ({
	phase: { kind: "idle" },
	packaged: false,
	lastChecked: null,
	available: null,

	init: async () => {
		try {
			const packaged = await isPackagedBuild();
			set({ packaged });
			if (packaged) {
				await get().check();
			}
		} catch {
			// The probe failed (unexpected shell environment, invoke error) —
			// stay silent: a background check must never throw an unhandled
			// rejection on boot. `check` carries its own error handling.
			set({ packaged: false });
		}
	},

	check: async () => {
		if (checking) return;
		checking = true;
		set({ phase: { kind: "checking" } });
		try {
			const update = await checkForUpdate();
			if (update) {
				set({
					phase: { kind: "available" },
					available: update,
					lastChecked: new Date().toISOString(),
				});
			} else {
				set({
					phase: { kind: "uptodate" },
					available: null,
					lastChecked: new Date().toISOString(),
				});
			}
		} catch (err) {
			set({
				phase: {
					kind: "error",
					message: err instanceof Error ? err.message : String(err),
				},
			});
		} finally {
			checking = false;
		}
	},

	install: async () => {
		const { available, packaged } = get();
		if (!available || !packaged) return;
		let downloaded = 0;
		let total = 0;
		set({ phase: { kind: "downloading", percent: null } });
		try {
			await available.downloadAndInstall((p: UpdateProgress) => {
				if (p.kind === "started") {
					total = p.totalBytes ?? 0;
					downloaded = 0;
					set({ phase: { kind: "downloading", percent: null } });
				} else if (p.kind === "progress") {
					downloaded += p.chunkBytes;
					set({
						phase: {
							kind: "downloading",
							percent:
								total > 0
									? Math.min(99, Math.round((downloaded / total) * 100))
									: null,
						},
					});
				} else {
					set({ phase: { kind: "downloading", percent: 100 } });
				}
			});
			set({ phase: { kind: "installing" } });
			// The app restarts (or, on Windows, exits) from here — nothing more
			// to update in this process.
		} catch (err) {
			set({
				phase: {
					kind: "error",
					message: err instanceof Error ? err.message : String(err),
				},
			});
		}
	},

	dismiss: () => set({ phase: { kind: "idle" }, available: null }),
}));
