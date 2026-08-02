import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GhostCard } from "@/components/ui/GhostCard";
import { Icon } from "@/components/ui/Icon";
import { Select } from "@/components/ui/Select";
import { fetchSettings, patchSettings } from "@/features/history/history-api.js";
import type { AppSettings } from "@vorynth/types";

const UNITS: Array<{ value: string; label: string }> = [
	{ value: "days", label: "Days" },
	{ value: "weeks", label: "Weeks" },
	{ value: "months", label: "Months" },
	{ value: "years", label: "Years" },
];

/**
 * Trash retention settings (v1.7.0).
 *
 * How long soft-deleted collections/history entries stay in the Trash before
 * being permanently purged (checked daily). 0 = keep until the user empties
 * the trash. Saved (bookmarked) items are never auto-purged (R-A10).
 */
export function TrashSection() {
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
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["app-settings"] }),
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

	return (
		<GhostCard>
			<h3 className="mb-4 flex items-center gap-2 font-label text-label-md uppercase tracking-widest text-on-surface-variant">
				<Icon name="delete" className="text-base" />
				Trash
			</h3>
			<p className="mb-4 font-body text-body-md leading-relaxed text-on-surface-variant">
				Deleting a collection or history entry moves it to the Trash instead of
				destroying it. After the retention window below, trashed entries are
				permanently deleted — saved items are never auto-deleted.
			</p>

			<div className="flex flex-col gap-1.5">
				<label
					htmlFor="trash-retention"
					className="font-label text-label-sm uppercase tracking-widest text-on-surface-variant"
				>
					Keep deleted items for
				</label>
				<div className="flex flex-wrap items-center gap-2">
					<input
						id="trash-retention"
						type="number"
						min={0}
						value={draftValue || String(value)}
						onChange={(e) => setDraftValue(e.target.value)}
						placeholder="e.g. 7"
						aria-label="Keep deleted items for (value)"
						className="w-24 rounded border border-outline-variant bg-surface-container-low px-3 py-2 font-body text-body-md text-on-surface outline-none focus:border-primary"
					/>
					<Select
						value={draftUnit || unit}
						onChange={(v) => setDraftUnit(v)}
						aria-label="Trash retention unit"
						options={UNITS}
						className="w-32"
					/>
					<button
						type="button"
						onClick={save}
						className="rounded bg-primary px-3 py-1.5 font-label text-label-sm text-on-primary"
					>
						Apply
					</button>
				</div>
				<p className="font-body text-body-sm text-on-tertiary-container">
					{value > 0
						? `e.g. 7 days removes trash entries older than 7 days. Currently ${value} ${unitLabel}.`
						: "0 keeps everything in the trash until you empty it. Currently off."}
				</p>
			</div>
		</GhostCard>
	);
}
