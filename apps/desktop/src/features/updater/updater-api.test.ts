import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkForUpdate } from "./updater-api.js";

// Plugin shell mocked; the error-mapping logic (the part we own) is real.
const mocks = vi.hoisted(() => ({
	check: vi.fn(),
	relaunch: vi.fn(),
	isTauriShell: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-updater", () => ({
	check: mocks.check,
}));

vi.mock("@tauri-apps/plugin-process", () => ({
	relaunch: mocks.relaunch,
}));

vi.mock("@/features/plugins/plugins-folder.js", () => ({
	isTauriShell: mocks.isTauriShell,
}));

describe("updater-api (v1.8.0)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.isTauriShell.mockReturnValue(true);
	});

	it("returns null outside the Tauri shell", async () => {
		mocks.isTauriShell.mockReturnValue(false);
		await expect(checkForUpdate()).resolves.toBeNull();
		expect(mocks.check).not.toHaveBeenCalled();
	});

	it("returns the update when a newer version exists", async () => {
		mocks.check.mockResolvedValue({
			version: "1.9.0",
			downloadAndInstall: vi.fn(),
		});
		const update = await checkForUpdate();
		expect(update?.version).toBe("1.9.0");
	});

	it("returns null when the plugin reports no update", async () => {
		mocks.check.mockResolvedValue(null);
		await expect(checkForUpdate()).resolves.toBeNull();
	});

	it("treats 'no update manifest published yet' as up to date, not an error", async () => {
		// The plugin rejects with this exact message when the release has no
		// latest.json asset (e.g. before the first signed release ships).
		mocks.check.mockRejectedValue(
			new Error("Could not fetch a valid release JSON from the remote"),
		);
		await expect(checkForUpdate()).resolves.toBeNull();
	});

	it("re-throws genuine check errors (network, GitHub down)", async () => {
		mocks.check.mockRejectedValue(new Error("connect timed out"));
		await expect(checkForUpdate()).rejects.toThrow("connect timed out");
	});
});
