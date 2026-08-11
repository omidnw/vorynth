import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	act,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import "@/i18n"; // initializes i18next so t() resolves the bundled catalog
import { ReaderActionsSection } from "./ReaderActionsSection.js";
import { READER_ACTION_ORDER } from "@/features/reader/reader-actions.js";

const mocks = vi.hoisted(() => ({
	fetchSettings: vi.fn(),
	patchSettings: vi.fn(),
}));

vi.mock("@/features/history/history-api.js", () => ({
	fetchSettings: mocks.fetchSettings,
	patchSettings: mocks.patchSettings,
}));

const DEFAULT_IN_MORE = ["recollect", "retranslate", "export", "openOriginal"];

function renderSection(
	order: string[] = [...READER_ACTION_ORDER],
	inMore: string[] = DEFAULT_IN_MORE,
) {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	mocks.fetchSettings.mockResolvedValue({
		"ui.readerActions": order,
		"ui.readerActionsInMore": inMore,
	});
	return render(
		<QueryClientProvider client={queryClient}>
			<ReaderActionsSection />
		</QueryClientProvider>,
	);
}

/** The reorder row wrapping a switch (the row is the focused, grabbable div). */
function rowOf(switchName: string): HTMLElement {
	const el = screen.getByRole("switch", { name: switchName });
	const row = el.closest("[tabindex='0']");
	if (!row) throw new Error(`no reorder row for ${switchName}`);
	return row as HTMLElement;
}

/**
 * ReaderActionsSection (v1.8.1) — the reader's bottom-bar buttons are ordered
 * by drag & drop and each can move behind the "More ⋮" menu. Both persist via
 * the app-settings API and apply to the Article + Insight pages.
 */
describe("ReaderActionsSection", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("lists every reader action in the saved order", async () => {
		renderSection();
		expect(await screen.findByText("Reader actions")).toBeInTheDocument();
		for (const id of READER_ACTION_ORDER) {
			expect(
				screen.getByRole("switch", { name: actionLabel(id) }),
			).toBeInTheDocument();
		}
	});

	// v1.8.1 — the switch reads naturally: ON = in the reader bar, OFF = behind
	// the "More ⋮" menu (not inverted).
	it("checks the actions that stay in the reader bar", async () => {
		renderSection();
		// The title renders before the settings query resolves — wait for the
		// persisted layout to land before asserting the checked states.
		await waitFor(() => {
			// Default: Mark read / Save / Share / Back in the bar (ON)…
			expect(screen.getByRole("switch", { name: "Mark read" })).toHaveAttribute(
				"aria-checked",
				"true",
			);
			expect(screen.getByRole("switch", { name: "Save" })).toHaveAttribute(
				"aria-checked",
				"true",
			);
			// …and Re-collect behind the More menu (OFF).
			expect(
				screen.getByRole("switch", { name: "Re-collect" }),
			).toHaveAttribute("aria-checked", "false");
		});
	});

	it("moves an action behind the More menu by turning its switch off", async () => {
		const user = userEvent.setup();
		renderSection();
		await user.click(await screen.findByRole("switch", { name: "Save" }));
		expect(mocks.patchSettings).toHaveBeenCalledWith({
			"ui.readerActionsInMore": [...DEFAULT_IN_MORE, "save"],
		});
	});

	it("reorders the bar by dragging a row onto another", async () => {
		renderSection();
		await screen.findByText("Reader actions");

		// The pointer-based reorder computes the drop target from the
		// container's geometry; jsdom reports 0×0 rects, so stub a fixed size
		// (8 rows × 40px) for the container to make the math deterministic.
		const markRow = rowOf("Mark read");
		const container = markRow.parentElement as HTMLElement;
		const ROW = 40;
		vi.spyOn(container, "getBoundingClientRect").mockReturnValue({
			top: 0,
			bottom: ROW * 8,
			height: ROW * 8,
			width: 300,
			left: 0,
			right: 300,
			x: 0,
			y: 0,
			toJSON: () => ({}),
		} as DOMRect);

		// Press the Mark-read row, drag to the second slot (clientY inside the
		// Save row), release. The reorder uses mouse events (WKWebView-safe).
		await act(async () => {
			fireEvent.mouseDown(markRow, { button: 0 });
		});
		await act(async () => {
			fireEvent.mouseMove(window, { clientY: ROW * 1.5 });
		});
		await act(async () => {
			fireEvent.mouseUp(window);
		});

		expect(mocks.patchSettings).toHaveBeenCalledWith({
			"ui.readerActions": [
				"save",
				"markRead",
				"recollect",
				"retranslate",
				"share",
				"export",
				"openOriginal",
				"back",
			],
		});
	});
});

function actionLabel(id: string): string {
	switch (id) {
		case "markRead":
			return "Mark read";
		case "save":
			return "Save";
		case "recollect":
			return "Re-collect";
		case "retranslate":
			return "Re-translate";
		case "share":
			return "Share";
		case "export":
			return "Export";
		case "openOriginal":
			return "Original";
		case "back":
			return "Back";
		default:
			return id;
	}
}
