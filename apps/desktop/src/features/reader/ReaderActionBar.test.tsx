import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReaderActionBar } from "./ReaderActionBar.js";
import type { ReaderAction } from "./reader-actions.js";

/**
 * ReaderActionBar (v1.8.0) — pinned actions render in the bar; the rest sit
 * behind the "More ⋮" menu. Nothing is hidden, the bar just stays uncluttered.
 */
function makeActions(): ReaderAction[] {
	return (
		[
			"markRead",
			"save",
			"recollect",
			"retranslate",
			"share",
			"export",
			"openOriginal",
			"back",
		] as const
	).map((id) => ({
		id,
		icon: "refresh",
		label: `Action:${id}`,
		onClick: vi.fn(),
	}));
}

describe("ReaderActionBar", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("renders the pinned actions and hides the rest behind More", () => {
		render(
			<ReaderActionBar
				actions={makeActions()}
				pinnedIds={undefined}
				moreLabel="More"
				moreAriaLabel="More story actions"
			/>,
		);
		expect(
			screen.getByRole("button", { name: /action:markread/i }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /action:save/i }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /action:back/i }),
		).toBeInTheDocument();
		// Recollect/export/openOriginal are not in the bar by default.
		expect(
			screen.queryByRole("button", { name: /action:recollect/i }),
		).toBeNull();
		expect(
			screen.getByRole("button", { name: /more story actions/i }),
		).toBeInTheDocument();
	});

	it("opens the More menu and runs an unpinned action", async () => {
		const user = userEvent.setup();
		const actions = makeActions();
		render(
			<ReaderActionBar
				actions={actions}
				pinnedIds={undefined}
				moreLabel="More"
				moreAriaLabel="More story actions"
			/>,
		);
		await user.click(
			screen.getByRole("button", { name: /more story actions/i }),
		);
		const recollectItem = screen.getByRole("menuitem", {
			name: /action:recollect/i,
		});
		expect(recollectItem).toBeInTheDocument();
		await user.click(recollectItem);
		const recollect = actions.find((a) => a.id === "recollect")!;
		expect(recollect.onClick).toHaveBeenCalledTimes(1);
	});

	it("renders no More menu when every action is pinned", () => {
		render(
			<ReaderActionBar
				actions={makeActions()}
				pinnedIds={[
					"markRead",
					"save",
					"recollect",
					"retranslate",
					"share",
					"export",
					"openOriginal",
					"back",
				]}
				moreLabel="More"
				moreAriaLabel="More story actions"
			/>,
		);
		expect(
			screen.queryByRole("button", { name: /more story actions/i }),
		).toBeNull();
		expect(
			screen.getByRole("button", { name: /action:export/i }),
		).toBeInTheDocument();
	});

	it("opens the More menu upward (bottom-full) since the footer sits at the bottom", async () => {
		const user = userEvent.setup();
		render(
			<ReaderActionBar
				actions={makeActions()}
				pinnedIds={undefined}
				moreLabel="More"
				moreAriaLabel="More story actions"
			/>,
		);
		await user.click(
			screen.getByRole("button", { name: /more story actions/i }),
		);
		// The popover must anchor above the button (dropUp) so it never falls
		// off-screen below the viewport edge.
		expect(screen.getByRole("menu").className).toContain("bottom-full");
	});
});
