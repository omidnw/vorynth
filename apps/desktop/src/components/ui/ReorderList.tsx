import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * v1.8.1 — mouse-based reorder list, safe in Tauri's WKWebView.
 *
 * HTML5 drag-and-drop (`draggable` + dragstart/dragover/drop) is unreliable
 * in WKWebView (drag events often never fire) and React pointer events don't
 * work in every environment, so reordering uses plain mouse events: press a
 * row (anywhere that isn't an interactive control) and drag. The rows REORDER
 * LIVE as the pointer crosses into a new slot, so the item visibly follows the
 * cursor and lands exactly where you release.
 *
 * Precision guarantee: the drag runs on a LOCAL working copy of the order
 * (synchronously updated in a ref), and the parent's `onReorder` fires ONCE
 * on release. Committing to the parent on every mousemove desynced the item's
 * tracked index from the parent's order (the "goes to the top/middle" bug),
 * because React re-renders can lag the mousemove stream. Keyboard reordering
 * (↑ / ↓) works too, so the list stays accessible.
 */
export function ReorderList({
	order,
	onReorder,
	className,
	children,
}: {
	/** The current ids in order. */
	order: string[];
	/** Commit a move: source index → target index (the caller persists). */
	onReorder: (from: number, to: number) => void;
	className?: string;
	/** Render one row; receives the id and its current index. */
	children: (id: string, index: number) => ReactNode;
}) {
	const [dragging, setDragging] = useState<string | null>(null);
	const [, setTick] = useState(0);
	const containerRef = useRef<HTMLDivElement>(null);
	// The dragged id + its ORIGINAL index; the working order is a synchronous
	// ref so the mousemove math never races React renders.
	const dragRef = useRef<{ id: string; from: number } | null>(null);
	const workingRef = useRef<string[]>([]);
	// The move/up handlers are recreated each render; keep the LATEST in a ref
	// so the drag listeners and the unmount cleanup always agree.
	const handlersRef = useRef<{ move: (e: MouseEvent) => void; up: () => void }>(
		{ move: () => undefined, up: () => undefined },
	);

	const display = dragging ? workingRef.current : order;

	const onMouseDown = (e: React.MouseEvent, i: number) => {
		if (e.button !== 0) return;
		// Don't hijack interactive controls — a click on the toggle/button
		// inside a row must toggle, not start a drag.
		if (
			(e.target as HTMLElement).closest(
				"button, a, input, select, [role='switch']",
			)
		)
			return;
		const id = display[i];
		if (id === undefined) return;
		workingRef.current = [...display];
		dragRef.current = { id, from: i };
		setDragging(id);
		window.addEventListener("mousemove", handlersRef.current.move);
		window.addEventListener("mouseup", handlersRef.current.up);
	};

	const handleMove = (e: MouseEvent) => {
		const el = containerRef.current;
		const drag = dragRef.current;
		if (!el || !drag) return;
		const working = workingRef.current;
		if (working.length === 0) return;
		// The slot under the pointer. Uniform rows (these lists are single-line
		// toggles), so the row height is the container's average.
		const rect = el.getBoundingClientRect();
		const rowHeight = rect.height / working.length;
		const target = Math.max(
			0,
			Math.min(
				working.length - 1,
				Math.floor((e.clientY - rect.top) / rowHeight),
			),
		);
		const current = working.indexOf(drag.id);
		if (target !== current) {
			working.splice(current, 1);
			working.splice(target, 0, drag.id);
			setTick((t) => t + 1);
		}
	};

	const handleUp = () => {
		window.removeEventListener("mousemove", handlersRef.current.move);
		window.removeEventListener("mouseup", handlersRef.current.up);
		const drag = dragRef.current;
		dragRef.current = null;
		if (drag) {
			const final = workingRef.current.indexOf(drag.id);
			if (final !== -1 && final !== drag.from) onReorder(drag.from, final);
		}
		workingRef.current = [];
		setDragging(null);
	};

	// Keep the ref pointing at the latest handlers, and clean up the window
	// listeners if the component unmounts mid-drag.
	handlersRef.current = { move: handleMove, up: handleUp };
	useEffect(
		() => () => {
			window.removeEventListener("mousemove", handlersRef.current.move);
			window.removeEventListener("mouseup", handlersRef.current.up);
		},
		[],
	);

	return (
		<div ref={containerRef} className={cn("select-none", className)}>
			{display.map((id, i) => (
				<div
					key={id}
					tabIndex={0}
					onMouseDown={(e) => onMouseDown(e, i)}
					onKeyDown={(e) => {
						if (e.key === "ArrowUp" && i > 0) onReorder(i, i - 1);
						else if (e.key === "ArrowDown" && i < order.length - 1)
							onReorder(i, i + 1);
					}}
					aria-grabbed={dragging === id}
					className={cn(
						"cursor-grab rounded border border-transparent outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40 active:cursor-grabbing",
						dragging === id && "opacity-50",
					)}
				>
					{children(id, i)}
				</div>
			))}
		</div>
	);
}
