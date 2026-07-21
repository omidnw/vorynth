import { useThemeStore } from "@/lib/theme/theme-store";
import { Icon } from "@/components/ui/Icon";

/**
 * Light/dark theme toggle.
 *
 * Both palettes ship from day one; this just flips `.dark` on <html>.
 */
export function ThemeToggle() {
	const theme = useThemeStore((s) => s.theme);
	const toggle = useThemeStore((s) => s.toggle);
	return (
		<button
			type="button"
			onClick={toggle}
			aria-label="Toggle theme"
			title={theme === "light" ? "Switch to dark" : "Switch to light"}
			className="text-on-surface-variant transition-colors hover:text-primary"
		>
			<Icon name={theme === "light" ? "dark_mode" : "light_mode"} />
		</button>
	);
}
