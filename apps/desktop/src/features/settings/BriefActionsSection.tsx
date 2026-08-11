import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { GhostCard } from "@/components/ui/GhostCard";
import { Icon } from "@/components/ui/Icon";
import { Toggle } from "@/components/ui/Toggle";
import { ReorderList } from "@/components/ui/ReorderList";
import {
	fetchSettings,
	patchSettings,
} from "@/features/history/history-api.js";

/**
 * v1.9.0 — the story-card footer actions, in canonical order. The card footer
 * renders them in `ui.briefActions` order; anything listed in
 * `ui.briefActionsInMore` moves behind the "More ⋮" menu instead.
 * v1.8.1 — Save is the card's quick action; "Mark read" moved out (it lives
 * on the reader bar + Viewed-stories history).
 */
export const BRIEF_ACTION_ORDER = ["readSource", "viewToggle", "save"] as const;
export type BriefActionId = (typeof BRIEF_ACTION_ORDER)[number];

export const DEFAULT_BRIEF_ACTIONS: BriefActionId[] = [...BRIEF_ACTION_ORDER];

/** Stable icon per action — the settings list and the card footer share these. */
export function briefActionIcon(id: BriefActionId): string {
	switch (id) {
		case "readSource":
			return "open_in_new";
		case "viewToggle":
			return "article";
		case "save":
			return "bookmark";
	}
}

/** User-facing label per action (i18n). */
export function briefActionLabel(
	t: (key: string) => string,
	id: BriefActionId,
): string {
	switch (id) {
		case "readSource":
			return t("settings.briefAction.readSource");
		case "viewToggle":
			return t("settings.briefAction.viewToggle");
		case "save":
			return t("settings.briefAction.save");
	}
}

/**
 * Settings → General → Story card actions (v1.9.0).
 *
 * Order the footer buttons on each brief story card (drag to reorder), and
 * choose which ones live behind the "More ⋮" menu. Persisted to
 * `ui.briefActions` (the full order) and `ui.briefActionsInMore` (the ones
 * behind More) via the app-settings API.
 */
export function BriefActionsSection() {
	const { t } = useTranslation();
	const queryClient = useQueryClient();
	const { data: settings } = useQuery({
		queryKey: ["app-settings"],
		queryFn: fetchSettings,
	});
	const raw = settings?.["ui.briefActions"];
	const order: string[] = Array.isArray(raw) ? raw : DEFAULT_BRIEF_ACTIONS;
	const rawInMore = settings?.["ui.briefActionsInMore"];
	const inMore: string[] = Array.isArray(rawInMore) ? rawInMore : [];

	const patch = useMutation({
		mutationFn: (p: Record<string, unknown>) => patchSettings(p),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: ["app-settings"] }),
	});

	// Optimistic local order so a drop re-orders instantly; it re-syncs to the
	// persisted settings whenever they arrive or change elsewhere.
	const [localOrder, setLocalOrder] = useState<string[] | null>(null);
	useEffect(() => {
		setLocalOrder(null);
	}, [settings]);
	const displayOrder = (localOrder ?? order).filter((id): id is BriefActionId =>
		(BRIEF_ACTION_ORDER as readonly string[]).includes(id),
	);

	const reorder = (from: number, to: number) => {
		if (from === to) return;
		const next = [...displayOrder];
		const [moved] = next.splice(from, 1);
		if (moved === undefined) return;
		next.splice(to, 0, moved);
		setLocalOrder(next);
		patch.mutate({ "ui.briefActions": next });
	};

	const toggleInMore = (id: string, on: boolean) => {
		const set = new Set(inMore);
		if (on) set.add(id);
		else set.delete(id);
		patch.mutate({ "ui.briefActionsInMore": [...set] });
	};

	return (
		<GhostCard>
			<h3 className="mb-2 flex items-center gap-2 font-label text-label-md uppercase tracking-widest text-on-surface-variant">
				<Icon name="view_week" className="text-base" />
				{t("settings.briefActionsTitle")}
			</h3>
			<p className="mb-2 font-body text-body-sm text-on-surface-variant">
				{t("settings.briefActionsHint")}
			</p>
			{/* v1.8.1 — pointer-based reorder (HTML5 DnD is unreliable in WKWebView):
			    press a row and drag to the target slot, or use ↑/↓ while focused. */}
			<ReorderList
				order={displayOrder}
				onReorder={reorder}
				className="divide-y divide-outline-variant"
			>
				{(id) => {
					// displayOrder is filtered to known ids, so the cast is safe.
					const action = id as BriefActionId;
					// ON = in the card footer; OFF = behind "More ⋮" (v1.8.1 —
					// the switch reads naturally, not inverted).
					const on = !inMore.includes(id);
					return (
						<div className="flex items-center gap-2 py-1">
							<Icon
								name="drag_indicator"
								className="cursor-grab text-[20px] text-on-surface-variant"
							/>
							<div className="flex-1">
								<Toggle
									icon={briefActionIcon(action)}
									label={briefActionLabel(t, action)}
									hint={
										on ? t("settings.briefInBar") : t("settings.briefInMore")
									}
									checked={on}
									onChange={(v) => toggleInMore(id, !v)}
								/>
							</div>
						</div>
					);
				}}
			</ReorderList>
		</GhostCard>
	);
}
