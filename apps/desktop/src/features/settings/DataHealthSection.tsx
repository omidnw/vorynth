import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { GhostCard } from "@/components/ui/GhostCard";
import { Icon } from "@/components/ui/Icon";
import { Toggle } from "@/components/ui/Toggle";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
	fetchSettings,
	patchSettings,
} from "@/features/history/history-api.js";
import { useJobsStore } from "@/features/jobs/jobs-store.js";
import { useFinishedJobError } from "@/features/jobs/use-finished-job-error.js";
import { aiErrorMessage } from "@/features/llm/ai-error.js";
import type { AppSettings } from "@vorynth/types";

/**
 * Data health check (v1.8.0) — the daily self-healing job.
 *
 * When the toggle is on (default), a background job runs daily and quietly
 * repairs stored articles: it fetches the full text of snippet-only stories,
 * re-translates (or honestly clears) translations that went stale when an
 * origin was upgraded, and — when Intelligence mode is on — generates the
 * missing AI insights (Why It Matters / Impact / Recommended Action). The
 * "Run data check now" button starts the same job on demand; it shows in the
 * Jobs tray like any other job, so nothing is hidden. Turning the toggle off
 * stops the automatic run only — the manual button still works.
 */
export function DataHealthSection() {
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

	const autoCheck =
		(settings?.["dataHealth.autoCheck"] as boolean | undefined) ?? true;
	const isActive = useJobsStore((s) => s.isActive("health-check"));
	const startHealthCheck = useJobsStore((s) => s.startHealthCheck);
	const [showConfirm, setShowConfirm] = useState(false);
	const jobError = useFinishedJobError();

	return (
		<GhostCard>
			<h3 className="mb-2 flex items-center gap-2 font-label text-label-md uppercase tracking-widest text-on-surface-variant">
				<Icon name="health_and_safety" className="text-base" />
				{t("settings.dataHealthTitle")}
			</h3>
			<Toggle
				icon="autorenew"
				label={t("settings.dataHealthAutoLabel")}
				hint={t("settings.dataHealthAutoHint")}
				checked={autoCheck}
				onChange={(on) => patch.mutate({ "dataHealth.autoCheck": on })}
			/>
			<div className="mt-2">
				{isActive ? (
					<span className="inline-flex items-center gap-2 font-label text-label-sm text-on-surface-variant">
						<Icon name="sync" className="animate-spin-reverse text-[16px]" />
						{t("settings.dataHealthBusy")}
					</span>
				) : (
					<Button
						variant="secondary"
						size="sm"
						icon="monitor_heart"
						onClick={() => setShowConfirm(true)}
					>
						{t("settings.dataHealthRun")}
					</Button>
				)}
				{jobError.error ? (
					<p className="mt-2 font-body text-body-sm text-error">
						{aiErrorMessage(t, jobError.error, "article.recollectFailed")}
					</p>
				) : null}
			</div>

			<ConfirmDialog
				open={showConfirm}
				title={t("settings.dataHealthRun")}
				message={t("settings.dataHealthConfirm")}
				confirmLabel={t("settings.dataHealthRun")}
				cancelLabel={t("common.cancel")}
				onConfirm={() => {
					setShowConfirm(false);
					void startHealthCheck().then((job) =>
						jobError.track(job?.id ?? null),
					);
				}}
				onCancel={() => setShowConfirm(false)}
				icon="monitor_heart"
				danger={false}
			/>
		</GhostCard>
	);
}
