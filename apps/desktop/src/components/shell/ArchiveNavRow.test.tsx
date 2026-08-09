import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import "@/i18n"; // register the react-i18next instance (English catalog)
import { ArchiveNavRow } from "@/components/shell/ArchiveNavRow.js";

function renderAt(path: string) {
	return render(
		<MemoryRouter initialEntries={[path]}>
			<Routes>
				<Route path="*" element={<ArchiveNavRow />} />
			</Routes>
		</MemoryRouter>,
	);
}

describe("ArchiveNavRow — Archive section navigation", () => {
	it("renders all five sections as links", () => {
		renderAt("/archive");

		const nav = screen.getByRole("navigation", { name: "Archive sections" });
		for (const label of [
			"Items",
			"Collections",
			"Bookmarks",
			"Search",
			"Trash",
		]) {
			expect(
				within(nav).getByRole("link", { name: label }),
			).toBeInTheDocument();
		}
	});

	it("highlights the current section with aria-current=page", () => {
		renderAt("/archive/trash");

		const nav = screen.getByRole("navigation", { name: "Archive sections" });
		expect(within(nav).getByRole("link", { name: "Trash" })).toHaveAttribute(
			"aria-current",
			"page",
		);
		expect(
			within(nav).getByRole("link", { name: "Items" }),
		).not.toHaveAttribute("aria-current");
	});

	it("Items is active only on the exact /archive route", () => {
		renderAt("/archive/search");

		const nav = screen.getByRole("navigation", { name: "Archive sections" });
		expect(within(nav).getByRole("link", { name: "Search" })).toHaveAttribute(
			"aria-current",
			"page",
		);
		// Inside a sibling sub-page, "Items" is not highlighted (end match).
		expect(
			within(nav).getByRole("link", { name: "Items" }),
		).not.toHaveAttribute("aria-current");
	});
});
