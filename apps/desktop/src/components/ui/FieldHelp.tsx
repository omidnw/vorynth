import { cn } from "@/lib/cn";
import { Icon } from "./Icon";
import { Tooltip } from "./Tooltip";

export interface FieldHelpProps {
	/** The explanation shown on hover/focus — also the accessible name. */
	label: string;
	/** RTL tooltip labels must render RTL. */
	dir?: "ltr" | "rtl";
	className?: string;
}

/**
 * FieldHelp — the "?" beside a field label. Hover/focus shows a one-line
 * explanation of what the field is (same family as DocsHelpButton: a themed
 * Tooltip wrapping a help_outline icon), so forms keep their labels short and
 * rich guidance stays one hover away instead of a hint paragraph under every
 * input (R-D07). The button keeps its own aria-label — the tooltip is a visual
 * enhancement, not the accessible name.
 */
export function FieldHelp({ label, dir, className }: FieldHelpProps) {
	return (
		<Tooltip label={label} dir={dir} wrap>
			<button
				type="button"
				aria-label={label}
				className={cn(
					"inline-flex shrink-0 cursor-help items-center rounded-full p-0.5 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-primary",
					className,
				)}
			>
				<Icon name="help_outline" className="text-[14px]" />
			</button>
		</Tooltip>
	);
}
