import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * Input — understated, 1px outline, focus shifts border to secondary.
 *
 * Per the color docs: "Focus state is indicated by the border color shifting
 * to Secondary." Geist is used for entered text.
 */
export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
	/** Optional leading icon name. */
	icon?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
	{ icon, className, ...rest },
	ref,
) {
	return (
		<div className="relative">
			{icon ? (
				<span className="material-symbols-outlined pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant">
					{icon}
				</span>
			) : null}
			<input
				ref={ref}
				// Entered text is often technical (URLs, keys, paths) — let the browser
				// pick the per-value direction so LTR content stays LTR inside RTL UIs.
				dir="auto"
				className={cn(
					// `block` collapses the wrapper to the input's real height — an
					// inline-level input sits on the text baseline and makes the
					// relative div taller than the field, so `top-1/2` on the icon
					// lands above the field's visual center.
					"block w-full border border-outline-variant bg-transparent px-4 py-3 font-mono text-mono-technical text-on-surface outline-none transition-colors",
					"placeholder:text-on-tertiary-container focus:border-secondary",
					icon && "ps-10",
					className,
				)}
				{...rest}
			/>
		</div>
	);
});
