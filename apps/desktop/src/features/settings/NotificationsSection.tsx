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
 * Notifications settings (v1.8.0) — what the notification center (and the OS
 * notification mirror) reports. Persisted via `notifications.*` app-settings;
 * the NotificationCenter applies them to the store so the watchers honor them.
 */
export function NotificationsSection() {
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

	const bool = (key: string, fallback: boolean) =>
		(settings?.[key] as boolean | undefined) ?? fallback;
	const enabled = bool("notifications.enabled", true);

	return (
		<GhostCard>
			<h3 className="mb-2 flex items-center gap-2 font-label text-label-md uppercase tracking-widest text-on-surface-variant">
				<Icon name="notifications" className="text-base" />
				{t("settings.notificationsTitle")}
			</h3>
			<p className="mb-4 font-body text-body-md text-on-surface-variant">
				{t("settings.notificationsHint")}
			</p>
			<div className="space-y-2">
				<Toggle
					icon="notifications"
					label={t("settings.notificationsEnabled")}
					hint={t("settings.notificationsEnabledHint")}
					checked={enabled}
					onChange={(on) => patch.mutate({ "notifications.enabled": on })}
				/>
				<Toggle
					icon="desktop_windows"
					label={t("settings.notificationsOs")}
					hint={t("settings.notificationsOsHint")}
					checked={bool("notifications.osEnabled", false)}
					onChange={(on) => patch.mutate({ "notifications.osEnabled": on })}
				/>
				<Toggle
					icon="task_alt"
					label={t("settings.notificationsJobFinished")}
					hint={t("settings.notificationsJobFinishedHint")}
					checked={bool("notifications.jobFinished", true)}
					onChange={(on) => patch.mutate({ "notifications.jobFinished": on })}
				/>
				<Toggle
					icon="system_update"
					label={t("settings.notificationsUpdateAvailable")}
					hint={t("settings.notificationsUpdateAvailableHint")}
					checked={bool("notifications.updateAvailable", true)}
					onChange={(on) =>
						patch.mutate({ "notifications.updateAvailable": on })
					}
				/>
			</div>
		</GhostCard>
	);
}
