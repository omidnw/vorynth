import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { DocsTipCard } from "@/features/docs/DocsTipCard.js";

/**
 * DocsTipCard — the shared page→docs link (R-D06). Renders the tip with its
 * title/subtitle and navigates to `/docs#<sectionId>` on click.
 */
function renderCard(props: {
	sectionId: string;
	title: string;
	subtitle: string;
}) {
	return render(
		<MemoryRouter initialEntries={["/archive/collections"]}>
			<Routes>
				<Route
					path="/archive/collections"
					element={<DocsTipCard {...props} />}
				/>
				<Route path="/docs" element={<div>DOCS PAGE</div>} />
			</Routes>
		</MemoryRouter>,
	);
}

describe("DocsTipCard", () => {
	it("renders the title and subtitle", () => {
		renderCard({
			sectionId: "collections",
			title: "How Collections work",
			subtitle: "Categories, folders, adding and removing items — explained",
		});
		expect(screen.getByText("How Collections work")).toBeInTheDocument();
		expect(
			screen.getByText(
				"Categories, folders, adding and removing items — explained",
			),
		).toBeInTheDocument();
	});

	it("navigates to the docs section on click", async () => {
		const user = userEvent.setup();
		renderCard({
			sectionId: "collections",
			title: "How Collections work",
			subtitle: "Explained",
		});
		await user.click(screen.getByRole("button", { name: "Read docs" }));
		expect(screen.getByText("DOCS PAGE")).toBeInTheDocument();
	});
});
