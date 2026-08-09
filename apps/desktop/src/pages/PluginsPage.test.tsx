import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { PluginInfo } from "@vorynth/types";
import "@/i18n"; // register the react-i18next instance (English catalog)
import { PluginsPage } from "@/pages/PluginsPage.js";

// API layer mocked; the page is real.
const mocks = vi.hoisted(() => ({
	fetchPlugins: vi.fn(),
	fetchPluginsDir: vi.fn(),
	installPlugin: vi.fn(),
	refreshConnectors: vi.fn(),
	scanPlugins: vi.fn(),
	setPluginEnabled: vi.fn(),
	uninstallPlugin: vi.fn(),
}));

vi.mock("@/features/plugins/plugins-api.js", () => mocks);

// The OS-open bridge (Tauri shell) is mocked; the page just calls it.
const folderMocks = vi.hoisted(() => ({
	isTauriShell: vi.fn(),
	openPluginsFolderInFileManager: vi.fn(),
	openPluginsFolderInTerminal: vi.fn(),
}));

vi.mock("@/features/plugins/plugins-folder.js", () => folderMocks);

const corePlugin: PluginInfo = {
	id: "rss",
	name: "RSS",
	description: "Web feeds — the standard way sites publish new stories.",
	version: "1.8.0",
	kind: "adapter",
	type: "rss",
	adapter: "rss",
	core: true,
	enabled: true,
	effectiveEnabled: true,
	dependencies: [],
	configFields: [],
};

const toggleablePlugin: PluginInfo = {
	id: "html",
	name: "HTML Crawler",
	description: "For sites with no feed at all.",
	version: "1.8.0",
	kind: "adapter",
	type: "html",
	adapter: "html",
	core: false,
	enabled: true,
	effectiveEnabled: true,
	dependencies: [],
	configFields: [],
};

const uiPlugin: PluginInfo = {
	id: "reference",
	name: "Reference Plugin",
	description: "A built-in example of a runtime UI plugin.",
	version: "1.8.0",
	kind: "ui",
	type: "reference",
	adapter: "reference",
	core: false,
	enabled: true,
	effectiveEnabled: true,
	dependencies: [],
	configFields: [],
};

const installedPlugin: PluginInfo = {
	id: "hello",
	name: "Hello Plugin",
	description: "A dropped-in test plugin.",
	version: "1.0.0",
	kind: "ui",
	type: "custom",
	adapter: "hello",
	core: false,
	enabled: true,
	effectiveEnabled: true,
	dependencies: [],
	configFields: [],
	installed: true,
};

function renderPage() {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(
		<QueryClientProvider client={queryClient}>
			<MemoryRouter initialEntries={["/plugins"]}>
				<PluginsPage />
			</MemoryRouter>
		</QueryClientProvider>,
	);
}

describe("PluginsPage — adapter plugin registry (v1.8.0)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		localStorage.clear();
		folderMocks.isTauriShell.mockReturnValue(true);
		folderMocks.openPluginsFolderInFileManager.mockResolvedValue(undefined);
		folderMocks.openPluginsFolderInTerminal.mockResolvedValue(undefined);
		mocks.fetchPlugins.mockResolvedValue([
			corePlugin,
			toggleablePlugin,
			uiPlugin,
		]);
		mocks.fetchPluginsDir.mockResolvedValue({ dir: "/data/plugins" });
		mocks.scanPlugins.mockResolvedValue({ added: [], removed: [] });
		mocks.refreshConnectors.mockResolvedValue({
			added: [],
			updated: [],
			unchanged: [],
			skipped: [],
		});
		mocks.uninstallPlugin.mockResolvedValue(undefined);
		mocks.setPluginEnabled.mockResolvedValue({
			...toggleablePlugin,
			enabled: false,
			effectiveEnabled: false,
		});
	});

	it("lists every adapter plugin with its description and version", async () => {
		renderPage();

		expect(await screen.findByText("RSS")).toBeInTheDocument();
		expect(screen.getByText("HTML Crawler")).toBeInTheDocument();
		expect(screen.getAllByText(/v1\.8\.0/).length).toBeGreaterThan(0);
		expect(
			screen.getByText("For sites with no feed at all."),
		).toBeInTheDocument();
	});

	it("groups plugins into Core, Installed, and Built-in sections", async () => {
		mocks.fetchPlugins.mockResolvedValue([
			corePlugin,
			installedPlugin,
			uiPlugin,
		]);
		renderPage();

		// Section headers — Core (also a badge text, so count), Built-in.
		expect(await screen.findByText("Hello Plugin")).toBeInTheDocument();
		expect(screen.getAllByText("Core").length).toBeGreaterThan(0);
		expect(screen.getByText("Built-in")).toBeInTheDocument();
		// The installed plugin appears in its own section with a badge.
		expect(screen.getAllByText("Installed").length).toBeGreaterThan(0);
	});

	it("shows an Official section with a badge and the connector's custom icon", async () => {
		const officialPlugin: PluginInfo = {
			id: "arxiv",
			name: "arXiv",
			description: "Scientific preprints.",
			version: "1.8.0",
			kind: "adapter",
			type: "arxiv",
			adapter: "arxiv",
			core: false,
			tier: "official",
			icon: "science",
			iconSrc: "/plugins/arxiv/icon.svg",
			enabled: true,
			effectiveEnabled: true,
			dependencies: [],
			configFields: [],
		};
		mocks.fetchPlugins.mockResolvedValue([officialPlugin, toggleablePlugin]);
		renderPage();

		expect(await screen.findByText("arXiv")).toBeInTheDocument();
		// Its own section header + the row badge.
		expect(screen.getByText("Official connectors")).toBeInTheDocument();
		expect(screen.getAllByText("Official").length).toBeGreaterThan(0);
		// The custom icon renders as a local image, not a ligature.
		const img = document.querySelector("img[src='/plugins/arxiv/icon.svg']");
		expect(img).not.toBeNull();
	});

	it("refreshes the official connector registry from GitHub on demand", async () => {
		mocks.refreshConnectors.mockResolvedValue({
			added: ["arxiv"],
			updated: [],
			unchanged: [],
			skipped: [],
		});
		const user = userEvent.setup();
		renderPage();
		const button = await screen.findByRole("button", {
			name: "Check GitHub for connectors",
		});
		await user.click(button);
		expect(mocks.refreshConnectors).toHaveBeenCalledOnce();
		// The success notice reports what was provisioned.
		expect(
			await screen.findByText(/official connector\(s\) provisioned/i),
		).toBeInTheDocument();
	});

	it("marks core adapters with a badge and a working toggle", async () => {
		const user = userEvent.setup();
		renderPage();
		await screen.findByText("RSS");

		// "Core" appears as both the section header and the row badge.
		expect(screen.getAllByText("Core").length).toBeGreaterThan(0);
		// Core adapters are toggleable like every other plugin.
		const sw = screen.getByRole("switch", { name: /RSS/ });
		expect(sw).toHaveAttribute("aria-checked", "true");
		await user.click(sw);
		expect(mocks.setPluginEnabled).toHaveBeenCalledWith("rss", {
			enabled: false,
		});
	});

	it("toggles a non-core adapter off and calls the API", async () => {
		const user = userEvent.setup();
		renderPage();
		await screen.findByText("HTML Crawler");

		const sw = screen.getByRole("switch", { name: /HTML Crawler/ });
		expect(sw).toHaveAttribute("aria-checked", "true");
		await user.click(sw);

		expect(mocks.setPluginEnabled).toHaveBeenCalledWith("html", {
			enabled: false,
		});
	});

	it("marks runtime UI plugins with a UI badge", async () => {
		renderPage();
		await screen.findByText("Reference Plugin");

		// The reference plugin row carries the "UI" badge.
		expect(screen.getByText("UI")).toBeInTheDocument();
		// ...and it's still toggleable (non-core).
		expect(
			screen.getByRole("switch", { name: /Reference Plugin/ }),
		).toHaveAttribute("aria-checked", "true");
	});

	it("renders contribution badges (theme / icons / fonts) from the manifest", async () => {
		mocks.fetchPlugins.mockResolvedValue([
			{
				...uiPlugin,
				id: "icons",
				name: "Icon Pack",
				contributions: ["icons", "fonts"],
			},
			{
				...uiPlugin,
				id: "reference",
				name: "Reference Plugin",
				contributions: ["theme"],
			},
		]);
		renderPage();
		await screen.findByText("Icon Pack");

		// Badge labels come from i18n (plugins.badgeTheme/Icons/Fonts).
		expect(screen.getByText("Icons")).toBeInTheDocument();
		expect(screen.getByText("Fonts")).toBeInTheDocument();
		expect(screen.getByText("Theme")).toBeInTheDocument();
		// The theme badge is on the reference row, not the Icon Pack row.
		expect(screen.getByText("Theme").closest(".rounded")).not.toBeNull();
	});

	it("shows a locked plugin as always on, with no toggle switch", async () => {
		mocks.fetchPlugins.mockResolvedValue([
			{
				...uiPlugin,
				id: "icons",
				name: "Icon Pack",
				core: true,
				locked: true,
				enabled: true,
				effectiveEnabled: true,
				contributions: ["icons", "fonts"],
			},
			corePlugin,
		]);
		renderPage();
		await screen.findByText("Icon Pack");

		// The locked plugin carries an "Always on" badge and no switch.
		expect(screen.getByText("Always on")).toBeInTheDocument();
		expect(screen.queryByRole("switch", { name: /Icon Pack/ })).toBeNull();
		// Other plugins keep their switches.
		expect(screen.getByRole("switch", { name: /RSS/ })).toBeInTheDocument();
	});
});

describe("PluginsPage — effective enable state", () => {
	it("shows the paused note when a dependency is off", async () => {
		mocks.fetchPlugins.mockResolvedValue([
			{
				...toggleablePlugin,
				enabled: true,
				effectiveEnabled: false,
				dependencies: ["gateway"],
			},
		]);
		const queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		render(
			<QueryClientProvider client={queryClient}>
				<MemoryRouter initialEntries={["/plugins"]}>
					<PluginsPage />
				</MemoryRouter>
			</QueryClientProvider>,
		);

		expect(await screen.findByText("HTML Crawler")).toBeInTheDocument();
		expect(
			screen.getByText("A dependency is off — this plugin is paused."),
		).toBeInTheDocument();
		expect(screen.getByText(/Depends on: gateway/)).toBeInTheDocument();
	});
});

describe("PluginsPage — search, hide-core, scan, remove (v1.8.0)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		localStorage.clear();
		mocks.fetchPlugins.mockResolvedValue([
			corePlugin,
			toggleablePlugin,
			uiPlugin,
		]);
		mocks.fetchPluginsDir.mockResolvedValue({ dir: "/data/plugins" });
		mocks.scanPlugins.mockResolvedValue({ added: [], removed: [] });
		mocks.uninstallPlugin.mockResolvedValue(undefined);
	});

	it("filters plugins as you type in the search box", async () => {
		const user = userEvent.setup();
		renderPage();
		await screen.findByText("RSS");

		await user.type(
			screen.getByRole("searchbox", { name: "Search plugins" }),
			"reference",
		);

		expect(screen.getByText("Reference Plugin")).toBeInTheDocument();
		expect(screen.queryByText("RSS")).not.toBeInTheDocument();
		expect(screen.queryByText("HTML Crawler")).not.toBeInTheDocument();
	});

	it("shows an empty-search message when nothing matches", async () => {
		const user = userEvent.setup();
		renderPage();
		await screen.findByText("RSS");

		await user.type(
			screen.getByRole("searchbox", { name: "Search plugins" }),
			"zzzz",
		);

		expect(screen.getByText(/No plugins match/)).toBeInTheDocument();
	});

	it("hides the Core section when the toggle is off, and remembers it", async () => {
		const user = userEvent.setup();
		const { unmount } = renderPage();
		await screen.findByText("RSS");

		await user.click(
			screen.getByRole("switch", { name: /hide core plugins/i }),
		);

		// Core plugins disappear; the rest still show.
		expect(screen.queryByText("RSS")).not.toBeInTheDocument();
		expect(screen.getByText("HTML Crawler")).toBeInTheDocument();
		expect(screen.getByText(/Core plugins are hidden/)).toBeInTheDocument();
		expect(localStorage.getItem("plugins:showCore")).toBe("false");

		// Remount — the preference is remembered across restarts.
		unmount();
		renderPage();
		await screen.findByText("HTML Crawler");
		expect(screen.queryByText("RSS")).not.toBeInTheDocument();
	});

	it("scans for plugins and reports newly installed ones", async () => {
		const user = userEvent.setup();
		mocks.scanPlugins.mockResolvedValue({ added: ["hello"], removed: [] });
		renderPage();
		await screen.findByText("RSS");

		await user.click(screen.getByRole("button", { name: /scan for plugins/i }));

		expect(mocks.scanPlugins).toHaveBeenCalled();
		expect(
			await screen.findByText(/1 plugin\(s\) installed/),
		).toBeInTheDocument();
	});

	it("shows the plugins folder users drop folders into", async () => {
		renderPage();
		expect(await screen.findByText("/data/plugins")).toBeInTheDocument();
	});

	it("opens the plugins folder in the file manager and in a terminal", async () => {
		const user = userEvent.setup();
		renderPage();
		await screen.findByText("/data/plugins");

		await user.click(screen.getByRole("button", { name: /open folder/i }));
		expect(folderMocks.openPluginsFolderInFileManager).toHaveBeenCalledWith(
			"/data/plugins",
		);

		await user.click(screen.getByRole("button", { name: /open in terminal/i }));
		expect(folderMocks.openPluginsFolderInTerminal).toHaveBeenCalledWith(
			"/data/plugins",
		);
	});

	it("disables the open buttons outside the desktop app (browser dev)", async () => {
		folderMocks.isTauriShell.mockReturnValue(false);
		renderPage();
		await screen.findByText("/data/plugins");

		expect(screen.getByRole("button", { name: /open folder/i })).toBeDisabled();
		expect(
			screen.getByRole("button", { name: /open in terminal/i }),
		).toBeDisabled();
		// The disabled state explains why (title on the button).
		expect(
			screen.getByRole("button", { name: /open folder/i }),
		).toHaveAttribute("title", "Only available in the Vorynth desktop app.");
	});

	it("removes an installed plugin through the confirmation dialog", async () => {
		const user = userEvent.setup();
		mocks.fetchPlugins.mockResolvedValue([installedPlugin, corePlugin]);
		renderPage();
		await screen.findByText("Hello Plugin");

		// The installed row carries an Installed badge and a Remove button
		// ("Installed" also names the section header).
		expect(screen.getAllByText("Installed").length).toBeGreaterThan(0);
		await user.click(screen.getByRole("button", { name: /^Remove$/ }));

		// Cancelling leaves the plugin in place.
		const dialog = await screen.findByRole("alertdialog");
		expect(dialog).toHaveTextContent("Remove Hello Plugin?");
		await user.click(within(dialog).getByRole("button", { name: /cancel/i }));
		expect(mocks.uninstallPlugin).not.toHaveBeenCalled();

		// Confirming calls the API.
		await user.click(screen.getByRole("button", { name: /^Remove$/ }));
		const dialog2 = await screen.findByRole("alertdialog");
		await user.click(within(dialog2).getByRole("button", { name: /^Remove$/ }));
		expect(mocks.uninstallPlugin).toHaveBeenCalledWith("hello", false);
	});

	it("built-in plugins have no Remove button", async () => {
		renderPage();
		await screen.findByText("RSS");
		expect(screen.queryByRole("button", { name: /^Remove$/ })).toBeNull();
	});

	it("installs a .vorynth-plugin package from the file picker", async () => {
		const user = userEvent.setup();
		mocks.installPlugin.mockResolvedValue({
			...installedPlugin,
			id: "hello",
			name: "Hello Plugin",
			version: "2.0.0",
		});
		renderPage();
		await screen.findByText("RSS");

		// The Install button opens the OS file picker (hidden input).
		await user.click(screen.getByRole("button", { name: /install plugin/i }));
		const file = new File([new Uint8Array([1, 2, 3])], "hello.vorynth-plugin", {
			type: "application/octet-stream",
		});
		await user.upload(screen.getByLabelText("Install plugin"), file);

		expect(mocks.installPlugin).toHaveBeenCalledTimes(1);
		expect(mocks.installPlugin.mock.calls[0]?.[0]).toBeInstanceOf(ArrayBuffer);
		expect(
			await screen.findByText(/Hello Plugin v2\.0\.0 installed/),
		).toBeInTheDocument();
	});

	it("shows an error when the package can't be installed", async () => {
		const user = userEvent.setup();
		mocks.installPlugin.mockRejectedValue(new Error("bad package"));
		renderPage();
		await screen.findByText("RSS");

		const file = new File([new Uint8Array([9])], "bad.vorynth-plugin");
		await user.upload(screen.getByLabelText("Install plugin"), file);

		expect(mocks.installPlugin).toHaveBeenCalledTimes(1);
		expect(
			await screen.findByText(/Couldn't install that plugin/),
		).toBeInTheDocument();
	});
});

describe("PluginsPage — security scan warnings (v1.8.0)", () => {
	/** A flagged installed plugin with one HIGH and one MEDIUM flag. */
	const flagged = (
		severity: "high" | "medium",
		enabled: boolean,
	): PluginInfo => ({
		...installedPlugin,
		id: "flagged",
		name: "Flagged Plugin",
		enabled,
		effectiveEnabled: enabled,
		security: {
			severity,
			scannedAt: "2026-08-03T00:00:00.000Z",
			flags: [
				{
					id: "eval",
					severity: "high",
					label: "eval() runs strings as code",
					evidence: 'eval("1+1")',
					count: 1,
				},
				{
					id: "external-url",
					severity: "medium",
					label: "external URL",
					evidence: "https://evil.example",
					count: 3,
				},
			],
		},
	});

	beforeEach(() => {
		vi.clearAllMocks();
		localStorage.clear();
		folderMocks.isTauriShell.mockReturnValue(true);
		mocks.fetchPluginsDir.mockResolvedValue({ dir: "/data/plugins" });
		mocks.setPluginEnabled.mockResolvedValue({
			...flagged("high", true),
			enabled: true,
			effectiveEnabled: true,
		});
	});

	it("shows a Security warning badge on HIGH-flagged plugins with a details panel", async () => {
		const user = userEvent.setup();
		mocks.fetchPlugins.mockResolvedValue([flagged("high", true)]);
		renderPage();
		await screen.findByText("Flagged Plugin");

		// The badge is a button that expands the findings.
		const badge = screen.getByRole("button", { name: /security warning/i });
		expect(badge).toHaveAttribute("aria-expanded", "false");
		await user.click(badge);

		// The details panel lists every flag with its severity, label, and
		// evidence snippet (repeated patterns carry a ×N count).
		expect(screen.getByText("What the scan found")).toBeInTheDocument();
		expect(screen.getByText("eval() runs strings as code")).toBeInTheDocument();
		expect(screen.getByText(/eval\("1\+1"\)/)).toBeInTheDocument();
		expect(screen.getByText("external URL")).toBeInTheDocument();
		expect(screen.getByText("×3")).toBeInTheDocument();
		// Severity chips — High (plugin level + flag) and Medium (flag).
		expect(screen.getAllByText("High").length).toBeGreaterThan(0);
		expect(screen.getByText("Medium")).toBeInTheDocument();
	});

	it("does not gate the toggle of an already-enabled HIGH-flagged plugin", async () => {
		const user = userEvent.setup();
		mocks.fetchPlugins.mockResolvedValue([flagged("high", true)]);
		renderPage();
		await screen.findByText("Flagged Plugin");

		// Turning OFF a flagged plugin needs no confirmation — it only reduces risk.
		await user.click(screen.getByRole("switch", { name: /Flagged Plugin/ }));
		expect(screen.queryByRole("alertdialog")).toBeNull();
		expect(mocks.setPluginEnabled).toHaveBeenCalledWith("flagged", {
			enabled: false,
		});
	});

	it("asks for confirmation before enabling a disabled HIGH-flagged plugin", async () => {
		const user = userEvent.setup();
		mocks.fetchPlugins.mockResolvedValue([flagged("high", false)]);
		renderPage();
		await screen.findByText("Flagged Plugin");

		// Toggling on a HIGH-flagged plugin opens the confirm dialog instead of
		// enabling it directly.
		await user.click(screen.getByRole("switch", { name: /Flagged Plugin/ }));
		const dialog = await screen.findByRole("alertdialog");
		expect(dialog).toHaveTextContent("Enable Flagged Plugin?");
		expect(mocks.setPluginEnabled).not.toHaveBeenCalled();

		// Confirming enables it.
		await user.click(
			within(dialog).getByRole("button", { name: /enable anyway/i }),
		);
		expect(mocks.setPluginEnabled).toHaveBeenCalledWith("flagged", {
			enabled: true,
		});
	});

	it("persists a per-plugin 'don't ask again' ack when the user ticks the box", async () => {
		const user = userEvent.setup();
		mocks.fetchPlugins.mockResolvedValue([flagged("high", false)]);
		renderPage();
		await screen.findByText("Flagged Plugin");

		await user.click(screen.getByRole("switch", { name: /Flagged Plugin/ }));
		const dialog = await screen.findByRole("alertdialog");
		await user.click(
			within(dialog).getByRole("checkbox", { name: /don't ask again/i }),
		);
		await user.click(
			within(dialog).getByRole("button", { name: /enable anyway/i }),
		);

		expect(localStorage.getItem("plugins:ack:flagged")).toBe("1");
		expect(mocks.setPluginEnabled).toHaveBeenCalledWith("flagged", {
			enabled: true,
		});
	});

	it("skips the confirmation for a plugin the user already acknowledged", async () => {
		const user = userEvent.setup();
		localStorage.setItem("plugins:ack:flagged", "1");
		mocks.fetchPlugins.mockResolvedValue([flagged("high", false)]);
		renderPage();
		await screen.findByText("Flagged Plugin");

		await user.click(screen.getByRole("switch", { name: /Flagged Plugin/ }));
		expect(screen.queryByRole("alertdialog")).toBeNull();
		expect(mocks.setPluginEnabled).toHaveBeenCalledWith("flagged", {
			enabled: true,
		});
	});

	it("warns but does NOT gate enabling a MEDIUM-flagged plugin", async () => {
		const user = userEvent.setup();
		mocks.fetchPlugins.mockResolvedValue([flagged("medium", false)]);
		renderPage();
		await screen.findByText("Flagged Plugin");

		// The medium badge shows a Security review — but enabling is ungated.
		expect(
			screen.getByRole("button", { name: /security review/i }),
		).toBeInTheDocument();
		await user.click(screen.getByRole("switch", { name: /Flagged Plugin/ }));
		expect(screen.queryByRole("alertdialog")).toBeNull();
		expect(mocks.setPluginEnabled).toHaveBeenCalledWith("flagged", {
			enabled: true,
		});
	});

	it("shows no security badge on clean plugins (no scan flags)", async () => {
		mocks.fetchPlugins.mockResolvedValue([installedPlugin]);
		renderPage();
		await screen.findByText("Hello Plugin");

		expect(screen.queryByText("Security warning")).toBeNull();
		expect(screen.queryByText("Security review")).toBeNull();
	});
});
