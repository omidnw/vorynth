import { useState } from "react";
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
 * Auto-delete retention settings (v1.6.0).
 *
 * A global "delete old stories" policy independent of each source's fetch
 * window. The user picks how old a story may get before it's removed, and
 * which stories are protected: bookmarked ones (R-A10) and ones placed in a
 * collection (user organization) can be kept no matter the age.
 */
export function RetentionSection() {
	const { t } = useTranslation();
	const queryClient = useQueryClient();
	const { data: settings } = useQuery({
		queryKey: ["app-settings"],
		queryFn: fetchSettings,
	});
	const [draftDays, setDraftDays] = useState("");

	const enabled =
		(settings?.["retention.autoDeleteDays"] as number | undefined) ?? 0;
	const protectBookmarked =
		(settings?.["retention.protectBookmarked"] as boolean | undefined) ?? true;
	const protectInCollection =
		(settings?.["retention.protectInCollection"] as boolean | undefined) ??
		true;

	const patch = useMutation({
		mutationFn: (changes: Partial<AppSettings>) => patchSettings(changes),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: ["app-settings"] }),
	});

	const toggleEnabled = (on: boolean) => {
		// Turning on with no value yet → default 30 days.
		patch.mutate({
			"retention.autoDeleteDays": on ? (enabled > 0 ? enabled : 30) : 0,
		});
	};

	const saveDays = () => {
		const days = Number(draftDays);
		if (days >= 1)
			patch.mutate({ "retention.autoDeleteDays": Math.floor(days) });
	};

	return (
		<GhostCard>
			<h3 className="mb-4 flex items-center gap-2 font-label text-label-md uppercase tracking-widest text-on-surface-variant">
				<Icon name="auto_delete" className="text-base" />
				{t("retention.title")}
			</h3>
			<p className="mb-4 font-body text-body-md leading-relaxed text-on-surface-variant">
				{t("retention.body")}
			</p>

			{/* Master toggle */}
			<Toggle
				icon="auto_delete"
				label={t("retention.enableLabel")}
				hint={
					enabled > 0
						? t("retention.olderThanDays", { count: enabled })
						: t("retention.offHint")
				}
				checked={enabled > 0}
				onChange={toggleEnabled}
			/>

			{enabled > 0 ? (
				<>
					{/* Days input — self-explanatory (R-D07) */}
					<div className="mb-4 flex flex-col gap-1.5">
						<label
							htmlFor="retention-days"
							className="font-label text-label-sm uppercase tracking-widest text-on-surface-variant"
						>
							{t("retention.deleteOlderThan")}
						</label>
						<div className="flex items-center gap-2">
							<input
								id="retention-days"
								type="number"
								min={1}
								value={draftDays || String(enabled)}
								onChange={(e) => setDraftDays(e.target.value)}
								placeholder={t("retention.daysPlaceholder")}
								aria-label={t("retention.deleteOlderThanAria")}
								className="w-24 rounded border border-outline-variant bg-surface-container-low px-3 py-2 font-body text-body-md text-on-surface outline-none focus:border-primary"
							/>
							<span className="font-label text-label-sm text-on-surface-variant">
								{t("retention.days")}
							</span>
							<button
								type="button"
								onClick={saveDays}
								className="rounded bg-primary px-3 py-1.5 font-label text-label-sm text-on-primary"
							>
								{t("retention.apply")}
							</button>
						</div>
						<p className="font-body text-body-sm text-on-tertiary-container">
							{t("retention.exampleHint")}
						</p>
					</div>

					{/* Protection toggles */}
					<div className="border-t border-outline-variant pt-2">
						<p className="mb-2 font-label text-label-sm uppercase tracking-widest text-on-surface-variant">
							{t("retention.neverDelete")}
						</p>
						<Toggle
							icon="bookmark"
							label={t("retention.protectBookmarked")}
							hint={t("retention.protectBookmarkedHint")}
							checked={protectBookmarked}
							onChange={(v) =>
								patch.mutate({ "retention.protectBookmarked": v })
							}
						/>
						<Toggle
							icon="folder"
							label={t("retention.protectInCollection")}
							hint={t("retention.protectInCollectionHint")}
							checked={protectInCollection}
							onChange={(v) =>
								patch.mutate({ "retention.protectInCollection": v })
							}
						/>
					</div>
				</>
			) : null}
		</GhostCard>
	);
}
