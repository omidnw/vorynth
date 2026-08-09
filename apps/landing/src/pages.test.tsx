import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { Root } from "./Root";

describe("hash routing", () => {
	beforeEach(() => {
		window.location.hash = "";
	});

	it("renders the landing home page by default", () => {
		render(<Root />);
		expect(
			screen.getByRole("heading", {
				name: /built for people who need to stay informed/i,
			}),
		).toBeInTheDocument();
	});

	it("renders the changelog page at #/changelog", () => {
		window.location.hash = "#/changelog";
		render(<Root />);
		expect(
			screen.getByRole("heading", { name: /^changelog$/i }),
		).toBeInTheDocument();
		// The app's own release data is rendered (newest first).
		expect(
			screen.getByRole("heading", { name: /^v1\.8\.0$/i }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: /^v1\.0\.0$/i }),
		).toBeInTheDocument();
		// Change entries carry type badges.
		expect(screen.getAllByText(/^New$/i).length).toBeGreaterThan(0);
	});

	it("renders the roadmap page at #/roadmap", () => {
		window.location.hash = "#/roadmap";
		render(<Root />);
		expect(
			screen.getByRole("heading", { name: /roadmap & status/i }),
		).toBeInTheDocument();
		// Markdown tables render as tables.
		expect(screen.getAllByRole("table").length).toBeGreaterThan(0);
	});

	it("switches pages when the hash changes", () => {
		render(<Root />);
		expect(
			screen.getByRole("heading", { name: /frequently asked questions/i }),
		).toBeInTheDocument();

		window.location.hash = "#/roadmap";
		fireEvent(window, new Event("hashchange"));
		expect(
			screen.getByRole("heading", { name: /roadmap & status/i }),
		).toBeInTheDocument();

		window.location.hash = "#/changelog";
		fireEvent(window, new Event("hashchange"));
		expect(
			screen.getByRole("heading", { name: /^changelog$/i }),
		).toBeInTheDocument();
	});
});
