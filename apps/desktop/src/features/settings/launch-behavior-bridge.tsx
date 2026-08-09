import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { fetchSettings } from "@/features/history/history-api.js";
import { isTauriShell } from "@/features/plugins/plugins-folder.js";

/**
 * Shell IPC for the launch-behavior settings (v1.8.0). Each is a no-op
 * outside the desktop app. The `@tauri-apps/api/core` import is static (not
 * dynamic): plugins-folder.ts already imports it, so it lives in the main
 * bundle either way — and a dynamic import under concurrent calls can
 * silently fail to resolve (two pushes in the same effect exposed it).
 */

/** Tell the shell the background-mode setting (close hides to tray). */
export async function pushBackgroundMode(enabled: boolean): Promise<void> {
	if (!isTauriShell()) return;
	try {
		await invoke("set_background_mode", { enabled });
	} catch (err) {
		console.warn("background mode push failed:", err);
	}
}

/** Tell the shell the launch-at-login setting (OS-level autostart hook). */
export async function pushLaunchAtLogin(enabled: boolean): Promise<void> {
	if (!isTauriShell()) return;
	try {
		await invoke("set_autostart", { enabled });
	} catch (err) {
		console.warn("launch-at-login push failed:", err);
	}
}

/**
 * Root-level bridge: pushes both persisted launch-behavior settings to the
 * shell as soon as settings load (and on every settings change).
 * LaunchSection lives on the Settings page, so a session that ended with
 * background mode on, or launch-at-login on, would never reach the shell on
 * the next launch if the user didn't open Settings — this mount closes that
 * gap: close-hides-to-tray and start-at-login work from the first boot.
 */
export function LaunchBehaviorBridge() {
	const { data: settings } = useQuery({
		queryKey: ["app-settings"],
		queryFn: fetchSettings,
		// Only the desktop app has a shell to push to — skip the fetch in a
		// plain dev browser.
		enabled: isTauriShell(),
	});
	useEffect(() => {
		if (settings === undefined) return;
		void pushBackgroundMode(settings?.["ui.backgroundMode"] === true);
		void pushLaunchAtLogin(settings?.["ui.launchAtStartup"] === true);
	}, [settings]);
	return null;
}
