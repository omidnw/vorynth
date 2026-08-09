import { useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface TooltipProps {
	/** The text shown in the tooltip. */
	label: string;
	/** The element the tooltip describes (usually an icon button). */
	children: ReactNode;
	/** Position — defaults to "top". */
	position?: "top" | "bottom";
	/** Direction of `label` — RTL labels (Persian/Arabic) must render RTL. */
	dir?: "ltr" | "rtl";
	/** Allow the label to wrap instead of a single line (long labels). */
	wrap?: boolean;
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
 * be themed or delayed (R-D07). Use this component. Pass `dir` when the label
 * is RTL so the bubble renders in the label's script direction.
 */
export function Tooltip({
	label,
	children,
	position = "top",
	dir,
	wrap,
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
					dir={dir}
					className={cn(
						"pointer-events-none absolute start-1/2 z-50 -translate-x-1/2 rtl:translate-x-1/2 rounded border border-outline-variant bg-surface-container-lowest px-3 py-1.5 font-body text-body-md text-on-surface shadow-lg",
						// wrap = sized to the label (like a native tooltip), only capping at a
						// comfortable reading width so long text wraps instead of overflowing.
						wrap
							? "w-max max-w-[400px] whitespace-normal"
							: "whitespace-nowrap",
						position === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5",
					)}
				>
					{label}
				</span>
			) : null}
		</span>
	);
}
