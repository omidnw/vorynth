import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import "@/i18n"; // register the react-i18next instance (English catalog)
import { WelcomeSection } from "./WelcomeSection.js";

function renderSection() {
	return render(
		<MemoryRouter>
			<WelcomeSection />
		</MemoryRouter>,
	);
}

const TOGGLE_NAME = "Show the welcome screen when Vorynth starts";

beforeEach(() => localStorage.clear());

describe("WelcomeSection", () => {
	it("shows the pending status and the open button by default", () => {
		renderSection();
		expect(screen.getByText("Not set up yet")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Open the welcome screen" }),
		).toBeInTheDocument();
	});

	it("turning the toggle off skips the welcome (defaults apply)", async () => {
		const user = userEvent.setup();
		renderSection();
		await user.click(screen.getByRole("switch", { name: TOGGLE_NAME }));
		expect(localStorage.getItem("vorynth.onboarding")).toBe("skipped");
		expect(
			screen.getByText("Welcome skipped — open it any time from here"),
		).toBeInTheDocument();
	});

	it("turning the toggle back on re-enables the welcome on launch", async () => {
		localStorage.setItem("vorynth.onboarding", "skipped");
		const user = userEvent.setup();
		renderSection();
		await user.click(screen.getByRole("switch", { name: TOGGLE_NAME }));
		expect(localStorage.getItem("vorynth.onboarding")).toBeNull();
		expect(screen.getByText("Not set up yet")).toBeInTheDocument();
	});
});
