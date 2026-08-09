import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ScrollArea } from "./ScrollArea.js";

/**
 * ScrollArea overflow affordance (v1.8.0) — the gradient fades must appear
 * only while there is more content to scroll, so a tall modal never hides
 * content behind a silent cut-off.
 */
describe("ScrollArea", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	function scroller(container: HTMLElement): HTMLElement {
		const el = container.querySelector(".overflow-y-auto");
		if (!el) throw new Error("scroll container not found");
		return el as HTMLElement;
	}

	function setSize(
		el: HTMLElement,
		over: number,
		viewport: number,
		top: number,
	) {
		Object.defineProperty(el, "scrollHeight", {
			value: over,
			configurable: true,
		});
		Object.defineProperty(el, "clientHeight", {
			value: viewport,
			configurable: true,
		});
		Object.defineProperty(el, "scrollTop", { value: top, configurable: true });
	}

	it("shows no fades when the content fits", () => {
		const { container } = render(
			<ScrollArea>
				<p>Short content</p>
			</ScrollArea>,
		);
		setSize(scroller(container), 100, 200, 0);
		fireEvent.scroll(scroller(container));
		expect(container.querySelector('[data-fade="bottom"]')).toBeNull();
		expect(container.querySelector('[data-fade="top"]')).toBeNull();
	});

	it("shows a bottom fade when content overflows and the user is at the top", () => {
		const { container } = render(
			<ScrollArea>
				<p>Tall content</p>
			</ScrollArea>,
		);
		setSize(scroller(container), 1000, 500, 0);
		fireEvent.scroll(scroller(container));
		expect(container.querySelector('[data-fade="bottom"]')).not.toBeNull();
		expect(container.querySelector('[data-fade="top"]')).toBeNull();
	});

	it("hides the bottom fade at the end and shows the top fade", () => {
		const { container } = render(
			<ScrollArea>
				<p>Tall content</p>
			</ScrollArea>,
		);
		setSize(scroller(container), 1000, 500, 499); // scrolled to the end
		fireEvent.scroll(scroller(container));
		expect(container.querySelector('[data-fade="bottom"]')).toBeNull();
		expect(container.querySelector('[data-fade="top"]')).not.toBeNull();
	});

	it("renders its children", () => {
		render(
			<ScrollArea>
				<p>Hello</p>
			</ScrollArea>,
		);
		expect(screen.getByText("Hello")).toBeInTheDocument();
	});
});
