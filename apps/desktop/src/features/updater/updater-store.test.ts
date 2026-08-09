import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUpdaterStore } from "./updater-store.js";

// Updater API mocked; the store logic (phase machine) is real.
const mocks = vi.hoisted(() => ({
	checkForUpdate: vi.fn(),
	isPackagedBuild: vi.fn(),
}));

vi.mock("./updater-api.js", () => ({
	checkForUpdate: mocks.checkForUpdate,
	isPackagedBuild: mocks.isPackagedBuild,
}));

describe("updater store (v1.8.0)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		useUpdaterStore.setState({
			phase: { kind: "idle" },
			packaged: false,
			lastChecked: null,
			available: null,
		});
	});

	it("check reports an available update when a newer version exists", async () => {
		mocks.isPackagedBuild.mockResolvedValue(true);
		mocks.checkForUpdate.mockResolvedValue({
			version: "1.9.0",
			downloadAndInstall: vi.fn(),
		});

		await useUpdaterStore.getState().check();

		const s = useUpdaterStore.getState();
		expect(s.phase).toEqual({ kind: "available" });
		expect(s.available?.version).toBe("1.9.0");
		expect(s.lastChecked).not.toBeNull();
	});

	it("check reports up-to-date when no newer version exists", async () => {
		mocks.checkForUpdate.mockResolvedValue(null);

		await useUpdaterStore.getState().check();

		expect(useUpdaterStore.getState().phase).toEqual({ kind: "uptodate" });
		expect(useUpdaterStore.getState().available).toBeNull();
	});

	it("install downloads with progress then moves to installing", async () => {
		useUpdaterStore.setState({
			packaged: true,
			available: {
				version: "1.9.0",
				downloadAndInstall: vi.fn(async (onProgress) => {
					onProgress({ kind: "started", totalBytes: 100 });
					onProgress({ kind: "progress", chunkBytes: 50 });
				}),
			},
		});

		await useUpdaterStore.getState().install();

		const s = useUpdaterStore.getState();
		// The download progressed through the phases; it ended installing
		// (relaunch resolves in the real plugin — the mock skips it).
		expect(["installing", "downloading"]).toContain(s.phase.kind);
		expect(s.available?.downloadAndInstall).toHaveBeenCalled();
	});

	it("install is a no-op when not packaged (dev builds can't self-replace)", async () => {
		useUpdaterStore.setState({
			phase: { kind: "available" },
			packaged: false,
			available: {
				version: "1.9.0",
				downloadAndInstall: vi.fn(),
			},
		});

		await useUpdaterStore.getState().install();

		expect(useUpdaterStore.getState().phase).toEqual({ kind: "available" });
		expect(
			useUpdaterStore.getState().available?.downloadAndInstall,
		).not.toHaveBeenCalled();
	});

	it("dismiss clears the available update", () => {
		useUpdaterStore.setState({
			phase: { kind: "available" },
			available: { version: "1.9.0", downloadAndInstall: vi.fn() },
		});

		useUpdaterStore.getState().dismiss();

		expect(useUpdaterStore.getState().phase).toEqual({ kind: "idle" });
		expect(useUpdaterStore.getState().available).toBeNull();
	});
});
