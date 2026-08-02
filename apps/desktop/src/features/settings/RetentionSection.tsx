import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GhostCard } from "@/components/ui/GhostCard";
import { Icon } from "@/components/ui/Icon";
import { Toggle } from "@/components/ui/Toggle";
import { fetchSettings, patchSettings } from "@/features/history/history-api.js";
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
	const queryClient = useQueryClient();
	const { data: settings } = useQuery({
		queryKey: ["app-settings"],
		queryFn: fetchSettings,
	});
	const [draftDays, setDraftDays] = useState("");

	const enabled = (settings?.["retention.autoDeleteDays"] as number | undefined) ?? 0;
	const protectBookmarked =
		(settings?.["retention.protectBookmarked"] as boolean | undefined) ?? true;
	const protectInCollection =
		(settings?.["retention.protectInCollection"] as boolean | undefined) ?? true;

	const patch = useMutation({
		mutationFn: (changes: Partial<AppSettings>) => patchSettings(changes),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["app-settings"] }),
	});

	const toggleEnabled = (on: boolean) => {
		// Turning on with no value yet → default 30 days.
		patch.mutate({ "retention.autoDeleteDays": on ? (enabled > 0 ? enabled : 30) : 0 });
	};

	const saveDays = () => {
		const days = Number(draftDays);
		if (days >= 1) patch.mutate({ "retention.autoDeleteDays": Math.floor(days) });
	};

	return (
		<GhostCard>
			<h3 className="mb-4 flex items-center gap-2 font-label text-label-md uppercase tracking-widest text-on-surface-variant">
				<Icon name="auto_delete" className="text-base" />
				Auto-delete old stories
			</h3>
			<p className="mb-4 font-body text-body-md leading-relaxed text-on-surface-variant">
				Vorynth keeps everything by default. Turn this on to automatically remove
				stories after they get too old — independent of each source's time range.
			</p>

			{/* Master toggle */}
			<Toggle
				icon="auto_delete"
				label="Auto-delete"
				hint={
					enabled > 0
						? `Stories older than ${enabled} days are removed (checked daily).`
						: "Off — every collected story is kept."
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
							Delete stories older than
						</label>
						<div className="flex items-center gap-2">
							<input
								id="retention-days"
								type="number"
								min={1}
								value={draftDays || String(enabled)}
								onChange={(e) => setDraftDays(e.target.value)}
								placeholder="e.g. 30"
								aria-label="Delete stories older than (days)"
								className="w-24 rounded border border-outline-variant bg-surface-container-low px-3 py-2 font-body text-body-md text-on-surface outline-none focus:border-primary"
							/>
							<span className="font-label text-label-sm text-on-surface-variant">days</span>
							<button
								type="button"
								onClick={saveDays}
								className="rounded bg-primary px-3 py-1.5 font-label text-label-sm text-on-primary"
							>
								Apply
							</button>
						</div>
						<p className="font-body text-body-sm text-on-tertiary-container">
							e.g. 30 removes any story collected more than 30 days ago. 0 turns
							auto-delete off.
						</p>
					</div>

					{/* Protection toggles */}
					<div className="border-t border-outline-variant pt-2">
						<p className="mb-2 font-label text-label-sm uppercase tracking-widest text-on-surface-variant">
							Never delete
						</p>
						<Toggle
							icon="bookmark"
							label="Bookmarked stories"
							hint="A bookmark is your ownership of a reference (R-A10)."
							checked={protectBookmarked}
							onChange={(v) => patch.mutate({ "retention.protectBookmarked": v })}
						/>
						<Toggle
							icon="folder"
							label="Stories in collections"
							hint="Anything you placed in a folder or category stays."
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
