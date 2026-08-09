import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/Icon";

/**
 * Connector/plugin icon resolver (v1.8.0). A plugin may carry a custom image
 * (`iconSrc` — a local, offline asset such as `/plugins/arxiv/icon.svg`) OR a
 * Material Symbols ligature (`icon` from the Icon Pack). When `iconSrc` is
 * set it wins and renders as an <img>; otherwise the glyph renders. Both are
 * decorative — `aria-hidden`, no alt text.
 */
export function PluginIcon({
	iconSrc,
	icon,
	className,
}: {
	iconSrc?: string;
	icon?: string;
	className?: string;
}) {
	if (iconSrc) {
		return (
			<img
				src={iconSrc}
				alt=""
				aria-hidden="true"
				draggable={false}
				className={cn("select-none object-contain", className)}
			/>
		);
	}
	return <Icon name={icon ?? "extension"} className={className} />;
}
