import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { GhostCard } from "@/components/ui/GhostCard";
import { Icon } from "@/components/ui/Icon";
import { Select, type SelectOption } from "@/components/ui/Select";
import {
	fetchSettings,
	patchSettings,
} from "@/features/history/history-api.js";
import type { AppSettings } from "@vorynth/types";

const UNIT_KEYS: Array<{ value: string; labelKey: string }> = [
	{ value: "days", labelKey: "trashUnits.days" },
	{ value: "weeks", labelKey: "trashUnits.weeks" },
	{ value: "months", labelKey: "trashUnits.months" },
	{ value: "years", labelKey: "trashUnits.years" },
];

/**
 * Trash retention settings (v1.7.0).
 *
 * How long soft-deleted collections/history entries stay in the Trash before
 * being permanently purged (checked daily). 0 = keep until the user empties
 * the trash. Saved (bookmarked) items are never auto-purged (R-A10).
 */
export function TrashSection() {
	const { t } = useTranslation();
	const queryClient = useQueryClient();
	const { data: settings } = useQuery({
		queryKey: ["app-settings"],
		queryFn: fetchSettings,
	});
	const [draftValue, setDraftValue] = useState("");
	const [draftUnit, setDraftUnit] = useState("days");

	const value = (settings?.["trash.retentionValue"] as number | undefined) ?? 7;
	const unit =
		(settings?.["trash.retentionUnit"] as string | undefined) ?? "days";

	const patch = useMutation({
		mutationFn: (changes: Partial<AppSettings>) => patchSettings(changes),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: ["app-settings"] }),
	});

	const save = () => {
		const n = Number(draftValue);
		if (Number.isNaN(n) || n < 0) return;
		patch.mutate({
			"trash.retentionValue": Math.floor(n),
			"trash.retentionUnit": draftUnit as AppSettings["trash.retentionUnit"],
		});
	};

	const unitLabel = value === 1 ? unit.slice(0, -1) : unit;
	const units: SelectOption[] = UNIT_KEYS.map((u) => ({
		value: u.value,
		label: t(u.labelKey),
	}));

	return (
		<GhostCard>
			<h3 className="mb-4 flex items-center gap-2 font-label text-label-md uppercase tracking-widest text-on-surface-variant">
				<Icon name="delete" className="text-base" />
				{t("trash.title")}
			</h3>
			<p className="mb-4 font-body text-body-md leading-relaxed text-on-surface-variant">
				{t("trash.body")}
			</p>

			<div className="flex flex-col gap-1.5">
				<label
					htmlFor="trash-retention"
					className="font-label text-label-sm uppercase tracking-widest text-on-surface-variant"
				>
					{t("trash.keepLabel")}
				</label>
				<div className="flex flex-wrap items-center gap-2">
					<input
						id="trash-retention"
						type="number"
						min={0}
						value={draftValue || String(value)}
						onChange={(e) => setDraftValue(e.target.value)}
						placeholder={t("trash.examplePlaceholder")}
						aria-label={t("trash.keepAria")}
						className="w-24 rounded border border-outline-variant bg-surface-container-low px-3 py-2 font-body text-body-md text-on-surface outline-none focus:border-primary"
					/>
					<Select
						value={draftUnit || unit}
						onChange={(v) => setDraftUnit(v)}
						aria-label={t("trash.unitAria")}
						options={units}
						className="w-32"
					/>
					<button
						type="button"
						onClick={save}
						className="rounded bg-primary px-3 py-1.5 font-label text-label-sm text-on-primary"
					>
						{t("trash.apply")}
					</button>
				</div>
				<p className="font-body text-body-sm text-on-tertiary-container">
					{value > 0
						? t("trash.sectionRetentionHint", { value, unit: unitLabel })
						: t("trash.sectionRetentionOff")}
				</p>
			</div>
		</GhostCard>
	);
}
