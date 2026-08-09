import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * A scrollable region that signals overflow honestly (v1.8.0).
 *
 * A bottom gradient fade — and a top one once you've scrolled down — appears
 * only while there is more content below/above, so a tall modal never hides
 * content behind a silent cut-off and the user can see the region scrolls
 * without having to try first. The fades are `pointer-events-none` overlays.
 *
 * Designed to slot into a `flex flex-col` dialog: the wrapper is
 * `min-h-0 flex-1`, so short content keeps the dialog compact and long content
 * fills up to the parent's `max-h` and scrolls.
 */
export function ScrollArea({
	children,
	className = "",
	/** Tailwind gradient stop color matching the surrounding surface. */
	fadeClassName = "from-surface-container",
	role,
	"aria-label": ariaLabel,
}: {
	children: ReactNode;
	className?: string;
	fadeClassName?: string;
	role?: string;
	"aria-label"?: string;
}) {
	const ref = useRef<HTMLDivElement>(null);
	const [canScrollUp, setCanScrollUp] = useState(false);
	const [canScrollDown, setCanScrollDown] = useState(false);

	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		const update = () => {
			const overflows = el.scrollHeight > el.clientHeight + 1;
			const atBottom = el.scrollTop >= el.scrollHeight - el.clientHeight - 1;
			setCanScrollUp(el.scrollTop > 1);
			setCanScrollDown(overflows && !atBottom);
		};
		update();
		el.addEventListener("scroll", update, { passive: true });
		// jsdom has no ResizeObserver — guard so tests (and odd environments)
		// don't throw; the scroll listener still tracks overflow changes.
		if (typeof ResizeObserver !== "undefined") {
			const ro = new ResizeObserver(update);
			ro.observe(el);
			return () => {
				el.removeEventListener("scroll", update);
				ro.disconnect();
			};
		}
		return () => el.removeEventListener("scroll", update);
	}, []);

	return (
		<div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
			<div
				ref={ref}
				role={role}
				aria-label={ariaLabel}
				className={`min-h-0 flex-1 overflow-y-auto overscroll-contain ${className}`}
			>
				{children}
			</div>
			{canScrollUp ? (
				<div
					aria-hidden
					data-fade="top"
					className={`pointer-events-none absolute inset-x-0 top-0 h-5 bg-gradient-to-b ${fadeClassName} to-transparent`}
				/>
			) : null}
			{canScrollDown ? (
				<div
					aria-hidden
					data-fade="bottom"
					className={`pointer-events-none absolute inset-x-0 bottom-0 h-5 bg-gradient-to-t ${fadeClassName} to-transparent`}
				/>
			) : null}
		</div>
	);
}
