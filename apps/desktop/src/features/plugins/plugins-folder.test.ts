import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));

import {
	isTauriShell,
	openPluginsFolderInFileManager,
	openPluginsFolderInTerminal,
} from "@/features/plugins/plugins-folder.js";

/**
 * plugins-folder (v1.8.0) — the OS-open bridge. The Tauri shell does the real
 * launching; these wrappers only exist inside the Tauri webview and no-op in a
 * plain browser (vite dev), so the page works either way.
 */
describe("plugins-folder — OS open bridge", () => {
	beforeEach(() => {
		mocks.invoke.mockReset();
		delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
	});

	it("detects the Tauri webview via __TAURI_INTERNALS__", () => {
		expect(isTauriShell()).toBe(false);
		(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
		expect(isTauriShell()).toBe(true);
	});

	it("invokes open_plugins_folder with the dir inside the Tauri shell", async () => {
		mocks.invoke.mockResolvedValue(undefined);
		(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};

		await openPluginsFolderInFileManager("/data/plugins");

		expect(mocks.invoke).toHaveBeenCalledWith("open_plugins_folder", {
			dir: "/data/plugins",
		});
	});

	it("invokes open_plugins_folder_in_terminal with the dir inside the Tauri shell", async () => {
		mocks.invoke.mockResolvedValue(undefined);
		(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};

		await openPluginsFolderInTerminal("/data/plugins");

		expect(mocks.invoke).toHaveBeenCalledWith(
			"open_plugins_folder_in_terminal",
			{
				dir: "/data/plugins",
			},
		);
	});

	it("no-ops outside the Tauri shell (browser dev) — invoke is never called", async () => {
		await openPluginsFolderInFileManager("/data/plugins");
		await openPluginsFolderInTerminal("/data/plugins");
		expect(mocks.invoke).not.toHaveBeenCalled();
	});

	it("propagates a failing shell command so the page can surface an error", async () => {
		mocks.invoke.mockRejectedValue(new Error("not a directory"));
		(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};

		await expect(openPluginsFolderInFileManager("/nope")).rejects.toThrow(
			"not a directory",
		);
	});
});
