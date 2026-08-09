import { apiFetch } from "@/lib/api/config";
import type {
	PluginDirInfo,
	PluginInfo,
	PluginScanResult,
	RefreshConnectorsResult,
	UpdatePluginInput,
} from "@vorynth/types";

/** v1.8.0 — adapter plugin registry client. */

export async function fetchPlugins(): Promise<PluginInfo[]> {
	return apiFetch<PluginInfo[]>("/plugins");
}

/** The `data/plugins/` path users drop plugin folders into. */
export async function fetchPluginsDir(): Promise<PluginDirInfo> {
	return apiFetch<PluginDirInfo>("/plugins/dir");
}

/** Enable/disable a plugin and/or merge into its persisted configuration. */
export async function patchPlugin(
	id: string,
	input: UpdatePluginInput,
): Promise<PluginInfo> {
	return apiFetch<PluginInfo>(`/plugins/${id}`, {
		method: "PATCH",
		body: JSON.stringify(input),
	});
}

export async function setPluginEnabled(
	id: string,
	input: UpdatePluginInput,
): Promise<PluginInfo> {
	return patchPlugin(id, input);
}

/** Re-scan `data/plugins/` for dropped-in plugin folders. */
export async function scanPlugins(): Promise<PluginScanResult> {
	return apiFetch<PluginScanResult>("/plugins/scan", { method: "POST" });
}

/**
 * Install a `.vorynth-plugin` package file (a ZIP holding plugin.json +
 * bundle.js). The file bytes go up as `application/octet-stream` — the engine
 * validates, extracts, and registers it.
 */
export async function installPlugin(bytes: ArrayBuffer): Promise<PluginInfo> {
	return apiFetch<PluginInfo>("/plugins/install", {
		method: "POST",
		body: bytes,
		headers: { "Content-Type": "application/octet-stream" },
	});
}

/** Uninstall a user-installed plugin (409 unless force when sources use it). */
export async function uninstallPlugin(
	id: string,
	force = false,
): Promise<void> {
	return apiFetch<void>(
		`/plugins/${encodeURIComponent(id)}${force ? "?force=true" : ""}`,
		{ method: "DELETE" },
	);
}

/** v1.8.0 — fetch the official connector registry from GitHub (cache-updating).
 *  Provisions official connectors (e.g. arXiv) so they resolve like built-ins. */
export async function refreshConnectors(): Promise<RefreshConnectorsResult> {
	return apiFetch<RefreshConnectorsResult>("/connectors/refresh", {
		method: "POST",
	});
}
