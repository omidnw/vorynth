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
 * Source list settings (v1.8.0).
 *
 * The user's age is unknown, so lists marked 18+ are hidden from browsing on
 * the Sources page by default. This toggle controls that default; showing a
 * specific 18+ list on the page is a per-view, ephemeral choice — the setting
 * is the persistent policy. Nothing is ever deleted (R-A10).
 */
export function SourceListsSection() {
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

	const hideAdult =
		(settings?.["sourceLists.hideAdult"] as boolean | undefined) ?? true;

	return (
		<GhostCard>
			<h3 className="mb-2 flex items-center gap-2 font-label text-label-md uppercase tracking-widest text-on-surface-variant">
				<Icon name="view_list" className="text-base" />
				{t("settings.sourceListsTitle")}
			</h3>
			<Toggle
				icon="18_up_rating"
				label={t("settings.hideAdultLists")}
				hint={t("settings.hideAdultListsHint")}
				checked={hideAdult}
				onChange={(on) => patch.mutate({ "sourceLists.hideAdult": on })}
			/>
		</GhostCard>
	);
}
