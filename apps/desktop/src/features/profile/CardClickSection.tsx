import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { GhostCard } from "@/components/ui/GhostCard";
import { Icon } from "@/components/ui/Icon";
import { Toggle } from "@/components/ui/Toggle";
import {
	fetchSettings,
	patchSettings,
} from "@/features/history/history-api.js";

/**
 * Profile → Card click (v1.8.0).
 *
 * Whether dragging the mouse across a brief card selects the text (and does
 * NOT open the story) or opens the story right away. Default on — most users
 * select with a drag and expect it not to navigate.
 */
export function CardClickSection() {
	const { t } = useTranslation();
	const queryClient = useQueryClient();
	const { data: settings } = useQuery({
		queryKey: ["app-settings"],
		queryFn: fetchSettings,
	});
	const dragSelectsText = settings?.["ui.dragSelectsText"] ?? true;

	const patch = useMutation({
		mutationFn: (p: Record<string, unknown>) => patchSettings(p),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: ["app-settings"] }),
	});

	return (
		<GhostCard>
			<h2 className="mb-2 flex items-center gap-2 font-headline text-headline-md text-primary dark:text-primary-fixed">
				<Icon name="gesture" className="text-[24px]" />
				{t("profile.cardClick")}
			</h2>
			<p className="mb-2 font-body text-body-sm text-on-surface-variant">
				{t("profile.cardClickHint")}
			</p>
			<Toggle
				icon="select_all"
				label={t("profile.dragSelectsText")}
				hint={t("profile.dragSelectsTextHint")}
				checked={dragSelectsText}
				onChange={(v) => patch.mutate({ "ui.dragSelectsText": v })}
			/>
		</GhostCard>
	);
}
