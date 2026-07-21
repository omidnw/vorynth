import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";

/**
 * Material Symbols icon wrapper.
 *
 * Uses the same font + `data-icon` pattern as the example HTML. `fill` toggles
 * the Material "FILL" axis (e.g. for active icons like bolt/lightbulb).
 */
export interface IconProps {
	/** Material Symbols name, e.g. "today", "psychology", "bolt". */
	name: string;
	className?: string;
	/** Fill the icon (FILL 1). */
	fill?: boolean;
	style?: CSSProperties;
	title?: string;
}

export function Icon({
	name,
	className,
	fill = false,
	style,
	title,
}: IconProps) {
	return (
		<span
			className={cn("material-symbols-outlined select-none", className)}
			data-icon={name}
			aria-hidden={title ? undefined : true}
			title={title}
			style={{
				fontVariationSettings: fill ? '"FILL" 1' : '"FILL" 0',
				...style,
			}}
		>
			{name}
		</span>
	);
}
