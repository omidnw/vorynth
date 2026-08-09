import { useTranslation } from "react-i18next";
import { GhostCard } from "@/components/ui/GhostCard";
import { Icon } from "@/components/ui/Icon";
import {
	usePluginContributions,
	pluginSettingsSections,
} from "@/plugins/plugin-contributions.js";
import { usePluginsEnabled } from "@/plugins/plugin-hooks.js";

/**
 * Plugin settings sections (v1.9.0) — renders every enabled UI plugin's
 * `SettingsSection` component inside the Settings page. Each section owns its
 * own UI + config persistence (plugins.configuration via usePluginConfig).
 */
export function PluginSettingsSections() {
	const { t } = useTranslation();
	// Subscribe so late-loading plugins re-render this block.
	usePluginContributions();
	const sections = pluginSettingsSections();
	const enabled = usePluginsEnabled();

	if (sections.length === 0) return null;

	return (
		<>
			{sections.map(({ pluginId, name, Component }) => {
				if (!enabled[pluginId]) return null;
				return (
					<GhostCard key={pluginId}>
						<h3 className="mb-4 flex items-center gap-2 font-label text-label-md uppercase tracking-widest text-on-surface-variant">
							<Icon name="extension" className="text-base" />
							{t("plugins.settingsSectionTitle", {
								name,
								defaultValue: `${name} settings`,
							})}
						</h3>
						<Component pluginId={pluginId} />
					</GhostCard>
				);
			})}
		</>
	);
}
