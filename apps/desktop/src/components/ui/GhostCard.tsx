import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * Ghost card — depth via tonal segmentation, not shadows.
 *
 * 1px outline-variant border + subtle surface shift on hover. This is the
 * structural primitive every container in Vorynth composes (per the color
 * docs: "Use 'ghost cards' defined by a 1px Tertiary border").
 */
export interface GhostCardProps extends HTMLAttributes<HTMLDivElement> {
	/** Highlight the left edge in primary (used for "Recommended Action"). */
	accentLeft?: boolean;
	interactive?: boolean;
}

export const GhostCard = forwardRef<HTMLDivElement, GhostCardProps>(
	function GhostCard(
		{ accentLeft, interactive, className, children, ...rest },
		ref,
	) {
		return (
			<div
				ref={ref}
				className={cn(
					"rounded border border-outline-variant bg-surface-container-low p-6",
					accentLeft && "border-l-2 border-l-primary",
					interactive &&
						"cursor-pointer transition-colors hover:bg-surface-container",
					className,
				)}
				{...rest}
			>
				{children}
			</div>
		);
	},
);
