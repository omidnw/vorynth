import type { CSSProperties } from "react";
import { cn } from "./lib/cn";

/**
 * Material Symbols icon wrapper.
 *
 * Uses the same font + `data-icon` pattern as the example HTML. `fill` toggles
 * the Material "FILL" axis (e.g. for active icons like bolt/lightbulb).
 */

/** Icons whose glyph points a direction (arrows, chevrons, pagination). In RTL
 *  locales they must point the other way — they get `rtl:rotate-180`, so the
 *  `[dir="rtl"]` set on `<html>` by the locale store mirrors them with no
 *  re-render. Media controls (play, skip, fast-forward) and app metaphors
 *  (login/logout) are deliberately NOT mirrored — by convention they keep
 *  their direction in RTL UIs. */
const MIRROR_IN_RTL = new Set([
	"arrow_back",
	"arrow_forward",
	"arrow_back_ios",
	"arrow_forward_ios",
	"arrow_left",
	"arrow_right",
	"chevron_left",
	"chevron_right",
	"navigate_before",
	"navigate_next",
	"first_page",
	"last_page",
	"keyboard_arrow_left",
	"keyboard_arrow_right",
	"east",
	"west",
	"subdirectory_arrow_right",
	"undo",
	"redo",
]);

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
	const mirror = MIRROR_IN_RTL.has(name);
	return (
		<span
			className={cn(
				"material-symbols-outlined select-none",
				mirror && "rtl:rotate-180",
				className,
			)}
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
