import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { GhostCard } from "@/components/ui/GhostCard";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { patchSettings } from "@/features/history/history-api.js";

/**
 * Settings → General → Confirmation dialogs (v1.8.0, moved from Profile
 * v1.8.1). One-tap reset of every "don't ask again" choice so the app asks
 * for confirmation again before destructive actions.
 */
export function ConfirmResetSection() {
	const { t } = useTranslation();
	const patch = useMutation({
		mutationFn: (values: Parameters<typeof patchSettings>[0]) =>
			patchSettings(values),
	});

	return (
		<GhostCard className="flex items-center justify-between gap-4">
			<div className="flex items-center gap-3">
				<Icon
					name="touch_app"
					className="text-[24px] text-on-surface-variant"
				/>
				<div>
					<h3 className="font-label text-label-md uppercase tracking-widest text-on-surface-variant">
						{t("settings.confirmDialogs")}
					</h3>
					<p className="font-body text-body-sm text-on-tertiary-container">
						{t("settings.confirmDialogsHint")}
					</p>
				</div>
			</div>
			<Button
				variant="secondary"
				size="sm"
				onClick={() => {
					patch.mutate({ "ui.confirmDeleteProvider": true });
				}}
				disabled={patch.isPending}
			>
				{patch.isPending ? t("settings.resetting") : t("settings.resetAll")}
			</Button>
		</GhostCard>
	);
}
