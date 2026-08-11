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
 * Settings → General → Reader settings (v1.8.0, moved from Profile v1.8.1).
 *
 * Reading-experience preferences for the article reader: the support-author
 * reminder and whether source media is kept local by default.
 */
export function ReaderSettingsSection() {
	const { t } = useTranslation();
	const queryClient = useQueryClient();
	const { data: settings } = useQuery({
		queryKey: ["app-settings"],
		queryFn: fetchSettings,
	});
	const reminderOn = settings?.["reader.supportAuthorReminder"] ?? true;
	const keepLocal = settings?.["reader.defaultKeepMediaLocal"] ?? false;

	const patch = useMutation({
		mutationFn: (p: Record<string, unknown>) => patchSettings(p),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: ["app-settings"] }),
	});

	return (
		<GhostCard>
			<h2 className="mb-4 flex items-center gap-2 font-headline text-headline-md text-primary dark:text-primary-fixed">
				<Icon name="menu_book" className="text-[24px]" />
				{t("settings.readerSettings")}
			</h2>

			<Toggle
				icon="volunteer_activism"
				label={t("settings.supportReminder")}
				hint={t("settings.supportReminderHint")}
				checked={reminderOn}
				onChange={(v) => patch.mutate({ "reader.supportAuthorReminder": v })}
			/>
			<div className="my-4 h-px bg-outline-variant" />
			<Toggle
				icon="download"
				label={t("settings.keepMediaLocal")}
				hint={t("settings.keepMediaLocalHint")}
				checked={keepLocal}
				onChange={(v) => patch.mutate({ "reader.defaultKeepMediaLocal": v })}
			/>
		</GhostCard>
	);
}
