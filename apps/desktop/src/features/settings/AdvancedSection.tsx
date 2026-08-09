import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { GhostCard } from "@/components/ui/GhostCard";
import { Icon } from "@/components/ui/Icon";
import { Toggle } from "@/components/ui/Toggle";
import {
	fetchSettings,
	patchSettings,
} from "@/features/history/history-api.js";
import type { AppSettings } from "@vorynth/types";

/**
 * Advanced features (v1.8.0) — the power-user gate.
 *
 * "Show advanced features" reveals the Plugins page in the sidebar and makes
 * its route reachable. It's the single switch between the normal app (source
 * connectors resolve invisibly — non-technical users never see "plugin"
 * terminology) and the engineering surface. Default off; flipping it is
 * immediate and reversible.
 */
export function AdvancedSection() {
	const queryClient = useQueryClient();
	const { t } = useTranslation();
	const { data: settings } = useQuery({
		queryKey: ["app-settings"],
		queryFn: fetchSettings,
	});
	const patch = useMutation({
		mutationFn: (changes: Partial<AppSettings>) => patchSettings(changes),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: ["app-settings"] }),
	});

	const showAdvanced = settings?.["ui.showAdvancedFeatures"] === true;

	return (
		<GhostCard>
			<h3 className="mb-2 flex items-center gap-2 font-label text-label-md uppercase tracking-widest text-on-surface-variant">
				<Icon name="developer_mode" className="text-base" />
				{t("settings.advancedTitle")}
			</h3>
			<Toggle
				icon="extension"
				label={t("settings.showAdvancedFeatures")}
				hint={t("settings.showAdvancedFeaturesHint")}
				checked={showAdvanced}
				onChange={(on) => patch.mutate({ "ui.showAdvancedFeatures": on })}
			/>
		</GhostCard>
	);
}
