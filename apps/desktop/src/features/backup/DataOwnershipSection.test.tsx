import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@/i18n"; // register the react-i18next instance (English catalog)
import { DataOwnershipSection } from "./DataOwnershipSection.js";

// API layer mocked; the section (list + per-backup controls) is real.
const mocks = vi.hoisted(() => ({
	listBackups: vi.fn(),
	exportBackup: vi.fn(),
	restoreBackup: vi.fn(),
	deleteBackup: vi.fn(),
	deleteAllData: vi.fn(),
	downloadBackup: vi.fn(),
}));

vi.mock("./backup-api.js", () => ({
	listBackups: mocks.listBackups,
	exportBackup: mocks.exportBackup,
	restoreBackup: mocks.restoreBackup,
	deleteBackup: mocks.deleteBackup,
	deleteAllData: mocks.deleteAllData,
	downloadBackup: mocks.downloadBackup,
}));

function renderSection() {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(
		<QueryClientProvider client={queryClient}>
			<DataOwnershipSection />
		</QueryClientProvider>,
	);
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.listBackups.mockResolvedValue({ backups: [] });
	mocks.exportBackup.mockResolvedValue({
		path: "/backups/x.vorynth-backup",
		sizeBytes: 1024,
		createdAt: "2026-01-01T00:00:00.000Z",
	});
	mocks.restoreBackup.mockResolvedValue({ ok: true, message: "ok" });
	mocks.deleteBackup.mockResolvedValue({ ok: true });
	mocks.deleteAllData.mockResolvedValue({ ok: true, message: "gone" });
	mocks.downloadBackup.mockResolvedValue(undefined);
});

describe("DataOwnershipSection — backups list (v1.8.0)", () => {
	it("shows an empty-state hint when no backups exist yet", async () => {
		renderSection();
		expect(
			await screen.findByText("No backups yet — create one with Export below."),
		).toBeInTheDocument();
	});

	it("lists every backup with its flavor and per-file controls", async () => {
		mocks.listBackups.mockResolvedValue({
			backups: [
				{
					name: "vorynth-2026-01-01.vorynth-backup",
					path: "/b/a.vorynth-backup",
					sizeBytes: 2048,
					createdAt: "2026-01-01T00:00:00.000Z",
					kind: "vorynth-backup",
				},
				{
					name: "vorynth-2026-01-02.sqlite",
					path: "/b/b.sqlite",
					sizeBytes: 4096,
					createdAt: "2026-01-02T00:00:00.000Z",
					kind: "sqlite",
				},
			],
		});
		renderSection();

		expect(
			await screen.findByText("vorynth-2026-01-01.vorynth-backup"),
		).toBeInTheDocument();
		expect(screen.getByText("vorynth-2026-01-02.sqlite")).toBeInTheDocument();
		// Flavor labels distinguish engine snapshots from plain SQLite copies
		// (they share the meta line with size + date, so match by substring).
		expect(screen.getByText(/Engine backup/)).toBeInTheDocument();
		expect(screen.getByText(/SQLite copy/)).toBeInTheDocument();
		// Two rows → two download + two restore + two remove controls.
		expect(
			screen.getAllByRole("button", { name: "Save to Downloads" }),
		).toHaveLength(2);
		expect(screen.getAllByRole("button", { name: "Restore" })).toHaveLength(2);
		expect(
			screen.getAllByRole("button", { name: "Remove backup" }),
		).toHaveLength(2);
	});

	it("downloads a backup to the OS Downloads folder on click", async () => {
		mocks.listBackups.mockResolvedValue({
			backups: [
				{
					name: "vorynth-2026-01-01.vorynth-backup",
					path: "/b/a.vorynth-backup",
					sizeBytes: 2048,
					createdAt: "2026-01-01T00:00:00.000Z",
					kind: "vorynth-backup",
				},
			],
		});
		const user = userEvent.setup();
		renderSection();

		const btn = await screen.findByRole("button", {
			name: "Save to Downloads",
		});
		await user.click(btn);
		expect(mocks.downloadBackup).toHaveBeenCalledWith(
			"vorynth-2026-01-01.vorynth-backup",
		);
		await waitFor(() =>
			expect(
				screen.getByText("Saved to your Downloads folder."),
			).toBeInTheDocument(),
		);
	});
});
