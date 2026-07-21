import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { ImportanceTier } from "@vorynth/types";

/**
 * Importance badge — low-ink by design (examples/colors).
 *
 *   SIGNAL    → primary fill + on-primary text (highest urgency)
 *   TREND     → secondary fill + on-secondary text
 *   LOW NOISE → neutral surface-variant fill
 *
 * Used in Today's Brief to mark each ranked item.
 */
const TIER_STYLES: Record<ImportanceTier, string> = {
	signal: "bg-primary text-on-primary",
	trend: "bg-secondary text-on-secondary",
	"low-noise": "bg-surface-variant text-on-surface-variant",
};

export function ImportanceBadge({
	tier,
	children,
	className,
}: {
	tier: ImportanceTier;
	children: ReactNode;
	className?: string;
}) {
	return (
		<span
			className={cn(
				"inline-flex items-center rounded px-2 py-0.5 font-label text-label-sm uppercase tracking-widest",
				TIER_STYLES[tier],
				className,
			)}
		>
			{children}
		</span>
	);
}

/**
 * Domain tag — 1px outline, no fill, uppercase tracked.
 * Pure structural divider, never decorative.
 */
export function DomainTag({
	children,
	className,
	...rest
}: {
	children: ReactNode;
	className?: string;
} & React.HTMLAttributes<HTMLSpanElement>) {
	return (
		<span
			className={cn(
				"inline-flex items-center rounded border border-outline-variant px-2 py-0.5 font-label text-label-sm uppercase tracking-widest text-on-tertiary-container",
				className,
			)}
			{...rest}
		>
			{children}
		</span>
	);
}
