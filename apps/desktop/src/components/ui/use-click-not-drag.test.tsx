import { beforeAll } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useClickNotDrag } from "@vorynth/ui";

// jsdom's PointerEvent ignores clientX in the event init (it returns
// undefined) — swap in a MouseEvent-backed one so the drag-guard can read the
// press position. Real browsers provide these coordinates natively.
beforeAll(() => {
	window.PointerEvent = class PointerEvent extends MouseEvent {
		constructor(type: string, init: PointerEventInit) {
			super(type, init);
		}
	} as typeof PointerEvent;
});

function Harness({
	onOpen,
	enabled,
}: {
	onOpen: () => void;
	enabled?: boolean;
}) {
	const guard = useClickNotDrag(onOpen, enabled);
	return (
		<button {...guard} type="button" aria-label="story card">
			Title
		</button>
	);
}

describe("useClickNotDrag", () => {
	it("opens on a plain click (no pointer travel)", () => {
		const onOpen = vi.fn();
		render(<Harness onOpen={onOpen} />);
		const card = screen.getByRole("button", { name: "story card" });
		fireEvent.pointerDown(card, { clientX: 10, clientY: 10 });
		fireEvent.click(card, { clientX: 10, clientY: 10 });
		expect(onOpen).toHaveBeenCalledTimes(1);
	});

	it("ignores a drag — selecting text with the mouse must not navigate", () => {
		const onOpen = vi.fn();
		render(<Harness onOpen={onOpen} />);
		const card = screen.getByRole("button", { name: "story card" });
		fireEvent.pointerDown(card, { clientX: 10, clientY: 10 });
		fireEvent.click(card, { clientX: 45, clientY: 10 }); // 35px travel
		expect(onOpen).not.toHaveBeenCalled();
	});

	it("still opens on small jitter within the click slop", () => {
		const onOpen = vi.fn();
		render(<Harness onOpen={onOpen} />);
		const card = screen.getByRole("button", { name: "story card" });
		fireEvent.pointerDown(card, { clientX: 10, clientY: 10 });
		fireEvent.click(card, { clientX: 12, clientY: 9 }); // ~2px
		expect(onOpen).toHaveBeenCalledTimes(1);
	});

	it("opens on a drag when the guard is disabled (ui.dragSelectsText off)", () => {
		const onOpen = vi.fn();
		render(<Harness onOpen={onOpen} enabled={false} />);
		const card = screen.getByRole("button", { name: "story card" });
		fireEvent.pointerDown(card, { clientX: 10, clientY: 10 });
		fireEvent.click(card, { clientX: 45, clientY: 10 }); // 35px travel
		expect(onOpen).toHaveBeenCalledTimes(1);
	});
});
