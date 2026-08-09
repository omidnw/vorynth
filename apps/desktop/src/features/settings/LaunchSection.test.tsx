import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@/i18n"; // register the react-i18next instance (English catalog)
import { LaunchSection } from "@/features/settings/LaunchSection.js";
import { LaunchBehaviorBridge } from "@/features/settings/launch-behavior-bridge.js";

// API + Tauri shell layers mocked; the section (toggles + tip) is real.
const mocks = vi.hoisted(() => ({
	fetchSettings: vi.fn(),
	patchSettings: vi.fn(),
	isTauriShell: vi.fn(() => false),
	invoke: vi.fn(),
}));

vi.mock("@/features/history/history-api.js", () => ({
	fetchSettings: mocks.fetchSettings,
	patchSettings: mocks.patchSettings,
}));

vi.mock("@/features/plugins/plugins-folder.js", () => ({
	isTauriShell: mocks.isTauriShell,
}));

vi.mock("@tauri-apps/api/core", () => ({
	invoke: mocks.invoke,
}));

function renderSection() {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(
		<QueryClientProvider client={queryClient}>
			<LaunchSection />
		</QueryClientProvider>,
	);
}

// Applies to every test in the file (both describes): reset call records and
// restore the default mock implementations.
beforeEach(() => {
	vi.clearAllMocks();
	mocks.fetchSettings.mockResolvedValue({});
	mocks.patchSettings.mockResolvedValue({});
	mocks.isTauriShell.mockReturnValue(false);
	mocks.invoke.mockResolvedValue(undefined);
});

describe("LaunchSection — run in background (v1.8.0)", () => {
	it("defaults to off and renders the tip explaining tray behavior", async () => {
		renderSection();
		const toggle = await screen.findByRole("switch", {
			name: "Run in background",
		});
		expect(toggle).toHaveAttribute("aria-checked", "false");
		// The tip explains the background contract: leaves the Dock, lives in
		// the menu bar, engine keeps collecting.
		expect(screen.getByText(/leaves the Dock entirely/i)).toBeInTheDocument();
	});

	it("reflects a persisted background mode (on) from settings", async () => {
		mocks.fetchSettings.mockResolvedValue({ "ui.backgroundMode": true });
		renderSection();
		const toggle = await screen.findByRole("switch", {
			name: "Run in background",
		});
		// The switch renders before the settings query resolves — wait for the
		// persisted (on) state to land.
		await waitFor(() => expect(toggle).toHaveAttribute("aria-checked", "true"));
	});

	it("persists the toggle via PATCH /settings", async () => {
		const user = userEvent.setup();
		renderSection();
		const toggle = await screen.findByRole("switch", {
			name: "Run in background",
		});
		await user.click(toggle);
		expect(mocks.patchSettings).toHaveBeenCalledWith({
			"ui.backgroundMode": true,
		});
	});

	it("pushes the mode to the Tauri shell on toggle inside the app", async () => {
		mocks.isTauriShell.mockReturnValue(true);
		const user = userEvent.setup();
		renderSection();
		const toggle = await screen.findByRole("switch", {
			name: "Run in background",
		});
		await user.click(toggle);
		// The boot effect already told the shell the persisted (off) state;
		// the toggle must then tell it the new (on) state.
		expect(mocks.invoke).toHaveBeenLastCalledWith("set_background_mode", {
			enabled: true,
		});
	});
});

describe("LaunchSection — launch at login (v1.8.0)", () => {
	it("renders the launch-at-login toggle with an OS-specific hint", async () => {
		renderSection();
		const toggle = await screen.findByRole("switch", {
			name: "Launch at login",
		});
		expect(toggle).toHaveAttribute("aria-checked", "false");
		// The hint names whichever OS location this platform uses.
		expect(
			screen.getByText(/Login Items|Startup apps|Startup Applications/i),
		).toBeInTheDocument();
	});

	it("reflects a persisted launch-at-login (on) from settings", async () => {
		mocks.fetchSettings.mockResolvedValue({ "ui.launchAtStartup": true });
		renderSection();
		const toggle = await screen.findByRole("switch", {
			name: "Launch at login",
		});
		await waitFor(() => expect(toggle).toHaveAttribute("aria-checked", "true"));
	});

	it("persists the toggle via PATCH /settings", async () => {
		const user = userEvent.setup();
		renderSection();
		const toggle = await screen.findByRole("switch", {
			name: "Launch at login",
		});
		await user.click(toggle);
		expect(mocks.patchSettings).toHaveBeenCalledWith({
			"ui.launchAtStartup": true,
		});
	});

	it("pushes set_autostart to the shell on toggle inside the app", async () => {
		mocks.isTauriShell.mockReturnValue(true);
		const user = userEvent.setup();
		renderSection();
		const toggle = await screen.findByRole("switch", {
			name: "Launch at login",
		});
		await user.click(toggle);
		expect(mocks.invoke).toHaveBeenLastCalledWith("set_autostart", {
			enabled: true,
		});
	});
});

describe("LaunchSection — start without a window (v1.8.0)", () => {
	it("renders the start-hidden toggle off by default", async () => {
		renderSection();
		const toggle = await screen.findByRole("switch", {
			name: "Start without a window",
		});
		expect(toggle).toHaveAttribute("aria-checked", "false");
	});

	it("reflects a persisted start-hidden (on) from settings", async () => {
		mocks.fetchSettings.mockResolvedValue({ "ui.startHidden": true });
		renderSection();
		const toggle = await screen.findByRole("switch", {
			name: "Start without a window",
		});
		await waitFor(() => expect(toggle).toHaveAttribute("aria-checked", "true"));
	});

	it("persists the toggle via PATCH /settings (read by the shell at next launch)", async () => {
		const user = userEvent.setup();
		renderSection();
		const toggle = await screen.findByRole("switch", {
			name: "Start without a window",
		});
		await user.click(toggle);
		expect(mocks.patchSettings).toHaveBeenCalledWith({
			"ui.startHidden": true,
		});
	});
});

describe("LaunchBehaviorBridge — pushes persisted launch behavior to the shell on boot (v1.8.0)", () => {
	function renderBridge() {
		const queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		return render(
			<QueryClientProvider client={queryClient}>
				<LaunchBehaviorBridge />
			</QueryClientProvider>,
		);
	}

	it("tells the shell the persisted (on) mode once settings load", async () => {
		mocks.isTauriShell.mockReturnValue(true);
		mocks.fetchSettings.mockResolvedValue({ "ui.backgroundMode": true });
		renderBridge();
		await waitFor(() =>
			expect(mocks.invoke).toHaveBeenCalledWith("set_background_mode", {
				enabled: true,
			}),
		);
	});

	it("tells the shell off when the persisted mode is off", async () => {
		mocks.isTauriShell.mockReturnValue(true);
		mocks.fetchSettings.mockResolvedValue({});
		renderBridge();
		await waitFor(() =>
			expect(mocks.invoke).toHaveBeenCalledWith("set_background_mode", {
				enabled: false,
			}),
		);
	});

	it("pushes the persisted launch-at-login to the shell", async () => {
		mocks.isTauriShell.mockReturnValue(true);
		mocks.fetchSettings.mockResolvedValue({ "ui.launchAtStartup": true });
		renderBridge();
		await waitFor(() =>
			expect(mocks.invoke).toHaveBeenCalledWith("set_autostart", {
				enabled: true,
			}),
		);
	});

	it("does nothing in a plain browser (no Tauri shell)", async () => {
		// isTauriShell is false here (and stays false — clearAllMocks keeps
		// implementations, so the previous test's true must be overridden).
		mocks.isTauriShell.mockReturnValue(false);
		mocks.fetchSettings.mockResolvedValue({ "ui.launchAtStartup": true });
		renderBridge();
		// The query is disabled outside the shell — it must never fetch, and
		// therefore nothing can be pushed.
		await new Promise((r) => setTimeout(r, 50));
		expect(mocks.fetchSettings).not.toHaveBeenCalled();
	});
});
