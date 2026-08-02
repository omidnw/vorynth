import { useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface TooltipProps {
	/** The text shown in the tooltip. */
	label: string;
	/** The element the tooltip describes (usually an icon button). */
	children: ReactNode;
	/** Position — defaults to "top". */
	position?: "top" | "bottom";
	className?: string;
}

/**
 * Themed tooltip — replaces the browser's native `title` attribute with
 * Vorynth's design language (same family as `Select`'s popover: outline-variant
 * border, surface-container-lowest fill, soft shadow).
 *
 * The tooltip appears on hover/focus and is dismissed on blur/outside click.
 * The wrapped element keeps its own `aria-label` — the tooltip is a visual
 * enhancement, not the accessible name.
 *
 * **Never use the bare `title` attribute for interactive guidance** — it can't
 * be themed or delayed (R-D07). Use this component.
 */
export function Tooltip({
	label,
	children,
	position = "top",
	className,
}: TooltipProps) {
	const [open, setOpen] = useState(false);
	const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	const show = () => {
		if (closeTimer.current) clearTimeout(closeTimer.current);
		setOpen(true);
	};
	const hide = () => {
		// Small delay so moving to the tooltip doesn't flicker it closed.
		closeTimer.current = setTimeout(() => setOpen(false), 120);
	};

	return (
		<span
			className={cn("relative inline-flex", className)}
			onMouseEnter={show}
			onMouseLeave={hide}
			onFocus={show}
			onBlur={hide}
		>
			{children}
			{open ? (
				<span
					role="tooltip"
					className={cn(
						"pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded border border-outline-variant bg-surface-container-lowest px-2.5 py-1 font-label text-label-sm text-on-surface shadow-lg",
						position === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5",
					)}
				>
					{label}
				</span>
			) : null}
		</span>
	);
}
