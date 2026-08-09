import { Icon } from "./Icon";
import { useTheme } from "../theme";

/** Theme toggle — same icon convention as the desktop app: it shows the mode
 *  you'll switch TO (sun when dark, moon when light), so the page nav and the
 *  preview's top-bar toggle always display the same icon. */
export function ThemeToggle() {
	const { theme, toggle } = useTheme();
	const dark = theme === "dark";
	return (
		<button
			type="button"
			className="theme-toggle"
			onClick={toggle}
			aria-label="Toggle theme"
			title={dark ? "Switch to light" : "Switch to dark"}
		>
			<Icon name={dark ? "light_mode" : "dark_mode"} size={18} />
		</button>
	);
}
