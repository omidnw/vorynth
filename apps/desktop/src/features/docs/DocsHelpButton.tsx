import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/Icon";
import { Tooltip } from "@/components/ui/Tooltip";

/**
 * Icon-only "How it works" button — one predictable docs entry point shown in
 * page headers. Deep-links to the in-app docs section for that page
 * (`/docs#<sectionId>`). Replaces bottom "Read docs" cards so pages stay
 * minimal (Google MD3: rich guidance belongs in docs; inline text only for
 * micro-copy). The wrapped button keeps its own aria-label — the tooltip is a
 * visual enhancement, not the accessible name (R-D07).
 */
export function DocsHelpButton({
	sectionId,
	className,
}: {
	sectionId: string;
	className?: string;
}) {
	const navigate = useNavigate();
	return (
		<Tooltip label="How it works">
			<button
				type="button"
				onClick={() => navigate(`/docs#${sectionId}`)}
				aria-label="How it works"
				className={cn(
					"cursor-pointer rounded p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-primary",
					className,
				)}
			>
				<Icon name="help_outline" className="text-[20px]" />
			</button>
		</Tooltip>
	);
}
