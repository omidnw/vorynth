import { invoke } from "@tauri-apps/api/core";

/**
 * OS integration for the plugins folder (v1.8.0) — opening it in the native
 * file manager or in a terminal at that folder. The actual launching happens in
 * the Tauri shell (Rust `shell_ops`), which knows the per-OS commands
 * (Explorer / Finder / xdg-open; Windows Terminal / PowerShell, Terminal.app,
 * Linux default terminal).
 *
 * These are no-ops outside the desktop app (e.g. `vite` in a plain browser
 * during development) — there's no shell to open anything in.
 */

/** True when running inside the Tauri webview (vs. a plain browser in dev). */
export function isTauriShell(): boolean {
	return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** Open the plugins folder in the OS file manager (Explorer/Finder/xdg-open). */
export async function openPluginsFolderInFileManager(
	dir: string,
): Promise<void> {
	if (!isTauriShell()) return;
	await invoke("open_plugins_folder", { dir });
}

/**
 * Open the plugins folder in a terminal with that folder as the working
 * directory (PowerShell / Windows Terminal, Terminal.app, Linux default).
 */
export async function openPluginsFolderInTerminal(dir: string): Promise<void> {
	if (!isTauriShell()) return;
	await invoke("open_plugins_folder_in_terminal", { dir });
}
