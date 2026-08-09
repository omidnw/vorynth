import { useCallback, useRef, type MouseEvent, type PointerEvent } from "react";

/** Pointer travel (px) that still counts as a click rather than a drag. */
export const CLICK_SLOP = 5;

/**
 * Guard a card's `onClick` against text-selection drags.
 *
 * A plain `onClick` fires on mouseup even after the user dragged across the
 * text to select it, so selecting a story with the mouse would navigate into
 * it. These handlers only fire `onClick` when the pointer stayed within
 * `CLICK_SLOP` px of its press position — a genuine click still opens, a
 * selection drag is ignored. Keyboard activation (`onKeyDown`) is unaffected.
 *
 * `enabled` maps to the `ui.dragSelectsText` profile setting (default true):
 * turn it off to open the story on any press-release, drag or not.
 */
export function useClickNotDrag(onClick?: () => void, enabled = true) {
	const down = useRef<{ x: number; y: number } | null>(null);

	const onPointerDown = useCallback((e: PointerEvent<HTMLElement>) => {
		down.current = { x: e.clientX, y: e.clientY };
	}, []);

	const onMouseClick = useCallback(
		(e: MouseEvent<HTMLElement>) => {
			const p = down.current;
			down.current = null;
			// Guard off, or the press was never observed on this element (it
			// started outside) — don't block navigation on those edge cases.
			if (!enabled || !p) {
				onClick?.();
				return;
			}
			if (
				Math.abs(e.clientX - p.x) <= CLICK_SLOP &&
				Math.abs(e.clientY - p.y) <= CLICK_SLOP
			) {
				onClick?.();
			}
		},
		[onClick, enabled],
	);

	return { onPointerDown, onClick: onMouseClick };
}
