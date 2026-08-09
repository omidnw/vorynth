import { SidebarNavItem } from "@/components/shell/SidebarNav";
import {
	usePluginNavItems,
	usePluginsEnabled,
} from "@/plugins/plugin-hooks.js";

/**
 * Plugin nav group (v1.8.0) — sidebar entries contributed by enabled runtime UI
 * plugins. Each item routes to the plugin's own page (`/plugin/<id>`).
 *
 * Subscribes to the contribution store (via usePluginNavItems) so a plugin that
 * loads after the first paint still appears — reading the store snapshot once
 * made the item flaky across page refreshes.
 */
export function PluginNavGroup() {
	const items = usePluginNavItems();
	const enabled = usePluginsEnabled();

	if (items.length === 0) return null;

	return (
		<>
			{items.map((item) => {
				if (!enabled[item.pluginId]) return null;
				return (
					<SidebarNavItem
						key={`${item.pluginId}:${item.id}`}
						to={`/plugin/${item.pluginId}`}
						icon={item.icon}
						label={item.label}
					/>
				);
			})}
		</>
	);
}
