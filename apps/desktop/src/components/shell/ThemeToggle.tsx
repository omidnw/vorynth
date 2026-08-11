import {
	useThemeStore,
	currentThemeIcon,
	isDarkMode,
} from "@/lib/theme/theme-store";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/ui/Icon";

/**
 * Light/dark theme toggle.
 *
 * Both palettes ship from day one; this flips `.dark` on <html>. For plugin
 * themes it toggles the dark-mode class inside the active palette — the store
 * keeps light/dark mode working under any theme. When a plugin theme has its
 * own identity icon, that icon shows instead of the sun/moon.
 */
export function ThemeToggle({ showLabel = false }: { showLabel?: boolean }) {
	const { t } = useTranslation();
	const toggle = useThemeStore((s) => s.toggle);
	// Subscribe to theme + registry so the icon tracks the active theme (and
	// appears when a plugin theme registers after first paint).
	const theme = useThemeStore((s) => s.theme);
	useThemeStore((s) => s.registryVersion);
	const dark = isDarkMode();
	const isPluginTheme = theme !== "light" && theme !== "dark";
	const icon = isPluginTheme
		? currentThemeIcon(theme)
		: dark
			? "light_mode"
			: "dark_mode";
	return (
		<button
			type="button"
			onClick={toggle}
			aria-label={t("settings.themeToggleAria")}
			title={dark ? t("settings.switchToLight") : t("settings.switchToDark")}
			className="flex items-center gap-1.5 text-on-surface-variant transition-colors hover:text-on-surface"
		>
			{/* v1.8.1 — bigger icon + optional text label (header labels). */}
			<Icon name={icon} className="text-[24px]" />
			{showLabel ? (
				<span className="hidden font-label text-label-sm md:inline">
					{dark ? t("settings.switchToLight") : t("settings.switchToDark")}
				</span>
			) : null}
		</button>
	);
}
