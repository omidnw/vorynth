import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconProps } from "./Icon";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: Variant;
	size?: Size;
	/** Material Symbols name; rendered before the label. */
	icon?: IconProps["name"];
	iconFill?: boolean;
	iconRight?: IconProps["name"];
	/** Stretch to container width. */
	block?: boolean;
}

const VARIANTS: Record<Variant, string> = {
	// Primary: deep forest fill, 4px radius, no shadow.
	primary:
		"bg-primary text-on-primary hover:opacity-90 active:scale-[0.98] transition-all",
	// Secondary: transparent, 1px primary outline.
	secondary:
		"bg-transparent border border-primary text-primary hover:bg-primary-container hover:text-on-primary transition-colors",
	// Ghost: transparent, subtle surface fill on hover.
	ghost:
		"bg-transparent text-secondary hover:bg-surface-variant dark:hover:bg-tertiary-container transition-colors",
};

const SIZES: Record<Size, string> = {
	sm: "px-3 py-1.5 text-label-sm",
	md: "px-5 py-2.5 text-label-md tracking-wider",
	lg: "px-8 py-3 text-label-md tracking-wider",
};

/**
 * Button — Precision Minimalism variant.
 *
 * Matches the example HTML: 4px base radius (rectangular with soft corners),
 * uppercase tracked labels, no decorative shadows.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
	function Button(
		{
			variant = "primary",
			size = "md",
			icon,
			iconFill,
			iconRight,
			block,
			className,
			children,
			...rest
		},
		ref,
	) {
		return (
			<button
				ref={ref}
				className={cn(
					"inline-flex items-center justify-center gap-2 rounded font-label uppercase",
					VARIANTS[variant],
					SIZES[size],
					block && "w-full",
					className,
				)}
				{...rest}
			>
				{icon ? (
					<Icon name={icon} fill={iconFill} className="text-[18px]" />
				) : null}
				{children}
				{iconRight ? <Icon name={iconRight} className="text-[18px]" /> : null}
			</button>
		);
	},
);
