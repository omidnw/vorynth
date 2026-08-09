import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Reveal — the shared motion primitive (v1.8.0, R-D08).
 *
 * Wraps a conditionally-rendered panel/modal: while `open` it mounts with the
 * `enter` animation class; on close it stays mounted long enough for the `exit`
 * class to play before unmounting, so panels don't pop out instantly.
 *
 * Exit classes are the exact reverse of the enter ones — a drawer that slides
 * in from the end must slide back out, not fade away:
 *   animate-fade-in / animate-fade-out              backdrops, sub-lists
 *   animate-scale-in / animate-scale-out            dialogs, dropdowns
 *   animate-slide-in-start / animate-slide-out-start   panels anchored at the end
 *   animate-slide-in-end / animate-slide-out-end       panels anchored at the start
 *   animate-slide-in-end-full / animate-slide-out-end-full   edge-pinned drawers
 */
export interface RevealProps {
	open: boolean;
	children: ReactNode;
	/** Enter animation utility, e.g. "animate-scale-in". */
	enter?: string;
	/** Exit animation utility — the reverse of `enter`, e.g. "animate-scale-out". */
	exit?: string;
	/** How long to keep the panel mounted after close so the exit animation
	 *  can finish (ms). Must cover the longest exit animation used here.
	 *  Defaults to 180 (matches the fade/scale utilities). */
	duration?: number;
	className?: string;
}

export function Reveal({
	open,
	children,
	enter = "animate-fade-in",
	exit = "animate-fade-in",
	duration = 180,
	className,
}: RevealProps) {
	const [visible, setVisible] = useState(open);
	const [exiting, setExiting] = useState(false);

	useEffect(() => {
		if (open) {
			setVisible(true);
			setExiting(false);
			return;
		}
		if (!visible) return;
		setExiting(true);
		const timer = setTimeout(() => {
			setVisible(false);
			setExiting(false);
		}, duration);
		return () => clearTimeout(timer);
	}, [open, visible, duration]);

	if (!visible) return null;
	return (
		<div className={cn(exiting ? exit : enter, className)}>{children}</div>
	);
}
