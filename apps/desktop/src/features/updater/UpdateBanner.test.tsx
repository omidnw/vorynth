import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@/i18n"; // register the react-i18next instance (English catalog)
import { UpdateBanner } from "./UpdateBanner.js";
import { useUpdaterStore } from "./updater-store.js";

// Shell + API mocked; the banner (rendering + wiring) and store are real.
const mocks = vi.hoisted(() => ({
	isTauriShell: vi.fn(),
	isPackagedBuild: vi.fn(),
	checkForUpdate: vi.fn(),
	appInstallSize: vi.fn(),
}));

vi.mock("@/features/plugins/plugins-folder.js", () => ({
	isTauriShell: mocks.isTauriShell,
}));

vi.mock("./updater-api.js", () => ({
	isPackagedBuild: mocks.isPackagedBuild,
	checkForUpdate: mocks.checkForUpdate,
	appInstallSize: mocks.appInstallSize,
}));

describe("UpdateBanner (v1.8.0)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// The banner is purely presentational here; the boot auto-check (which
		// overwrites the store) is exercised by its own test below.
		mocks.isTauriShell.mockReturnValue(false);
		mocks.isPackagedBuild.mockResolvedValue(true);
		mocks.checkForUpdate.mockResolvedValue(null);
		useUpdaterStore.setState({
			phase: { kind: "idle" },
			packaged: true,
			lastChecked: null,
			available: null,
		});
	});

	it("renders nothing when the app is up to date", () => {
		useUpdaterStore.setState({ phase: { kind: "uptodate" } });
		const { container } = render(<UpdateBanner />);
		expect(container).toBeEmptyDOMElement();
	});

	it("shows the update prompt with the new version when one is available", () => {
		useUpdaterStore.setState({
			phase: { kind: "available" },
			available: { version: "1.9.0", downloadAndInstall: vi.fn() },
		});
		render(<UpdateBanner />);
		expect(screen.getByRole("status")).toHaveTextContent(
			"Update available — Vorynth 1.9.0 is ready",
		);
		expect(
			screen.getByRole("button", { name: "Download & install" }),
		).toBeTruthy();
	});

	it("shows the download progress while installing", () => {
		useUpdaterStore.setState({
			phase: { kind: "downloading", percent: 42 },
			available: { version: "1.9.0", downloadAndInstall: vi.fn() },
		});
		render(<UpdateBanner />);
		expect(screen.getByRole("progressbar")).toHaveAttribute(
			"aria-valuenow",
			"42",
		);
		expect(screen.getByText("42%")).toBeTruthy();
	});

	it("starts the install when the action button is clicked", async () => {
		const downloadAndInstall = vi.fn(async () => undefined);
		const user = userEvent.setup();
		useUpdaterStore.setState({
			phase: { kind: "available" },
			available: { version: "1.9.0", downloadAndInstall },
		});
		render(<UpdateBanner />);

		await user.click(
			screen.getByRole("button", { name: "Download & install" }),
		);

		expect(downloadAndInstall).toHaveBeenCalled();
	});

	it("checks GitHub releases on boot inside the packaged app", async () => {
		mocks.isTauriShell.mockReturnValue(true);
		render(<UpdateBanner />);
		await waitFor(() => expect(mocks.checkForUpdate).toHaveBeenCalledTimes(1));
	});
});
