import { DomainTag } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import type { ContentItemType } from "@vorynth/types";
import { typeMeta } from "./type-meta.js";

/**
 * Per-type badge for archive items — the type's icon + label in one chip
 * (v1.7.0). Replaces the text-only `DomainTag` everywhere items appear
 * (Archive, Bookmarks, collection tree) so each model type is recognizable
 * at a glance.
 */
export function TypeBadge({
	contentType,
	className,
}: {
	contentType: ContentItemType;
	className?: string;
}) {
	const meta = typeMeta(contentType);
	return (
		<DomainTag
			className={cn("gap-1.5 whitespace-nowrap", className)}
			title={`Type: ${meta.label}`}
		>
			<Icon name={meta.icon} className="text-[14px]" />
			{meta.label}
		</DomainTag>
	);
}
