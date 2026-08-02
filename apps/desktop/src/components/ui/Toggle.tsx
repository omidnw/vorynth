import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/Icon";

/**
 * Switch-style toggle with icon + label + hint.
 *
 * Extracted from HistorySection (v1.5.0) for reuse across Settings — used by
 * the history-recording toggles AND the Intelligence/News mode switch.
 */
export function Toggle({
	icon,
	label,
	hint,
	checked,
	onChange,
}: {
	icon: string;
	label: string;
	hint: string;
	checked: boolean;
	onChange: (v: boolean) => void;
}) {
	return (
		<div className="flex items-start justify-between gap-4 py-3">
			<div className="flex items-start gap-3">
				<Icon
					name={icon}
					className="mt-0.5 text-[18px] text-on-surface-variant"
				/>
				<div>
					<p className="font-label text-label-md text-on-surface">{label}</p>
					<p className="font-body text-body-sm text-on-surface-variant">
						{hint}
					</p>
				</div>
			</div>
			<button
				type="button"
				role="switch"
				aria-checked={checked}
				aria-label={label}
				onClick={() => onChange(!checked)}
				className={cn(
					"relative h-6 w-11 flex-none rounded-full transition-colors",
					checked ? "bg-primary" : "bg-surface-variant",
				)}
			>
				<span
					className={cn(
						"absolute top-0.5 h-5 w-5 rounded-full bg-surface-container-lowest transition-all",
						checked ? "left-[22px]" : "left-0.5",
					)}
				/>
			</button>
		</div>
	);
}
