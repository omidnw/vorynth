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
 * Media settings (v1.8.0).
 *
 * Before the first media download, Vorynth shows a one-time disclaimer warning
 * that the source blog's privacy policy may restrict downloading its content.
 * "Don't show again" (on that dialog) turns the warning off; this toggle turns
 * it back on — the setting is the persistent policy, the dialog is the gate.
 */
export function MediaSettingsSection() {
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

	const showWarning = settings?.["media.showDownloadWarning"] !== false;

	return (
		<GhostCard>
			<h3 className="mb-2 flex items-center gap-2 font-label text-label-md uppercase tracking-widest text-on-surface-variant">
				<Icon name="photo_library" className="text-base" />
				{t("settings.mediaTitle")}
			</h3>
			<Toggle
				icon="privacy_tip"
				label={t("settings.showMediaDownloadWarning")}
				hint={t("settings.showMediaDownloadWarningHint")}
				checked={showWarning}
				onChange={(on) => patch.mutate({ "media.showDownloadWarning": on })}
			/>
		</GhostCard>
	);
}
