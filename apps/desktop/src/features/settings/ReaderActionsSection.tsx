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
import {
	READER_ACTION_ORDER,
	readerActionIcon,
	readerActionLabel,
	type ReaderActionId,
} from "@/features/reader/reader-actions.js";

/**
 * Settings → General → Reader actions (v1.8.0, drag-reorder v1.8.1).
 *
 * Order the buttons of the story-reader bottom bar (Article + Insight pages)
 * by dragging, and choose which ones live behind the "More ⋮" menu —
 * nothing is hidden, the bar just stays uncluttered. Persisted to
 * `ui.readerActions` (the full order) and `ui.readerActionsInMore` (the ones
 * behind More) via the app-settings API.
 */
export function ReaderActionsSection() {
	const { t } = useTranslation();
	const queryClient = useQueryClient();
	const { data: settings } = useQuery({
		queryKey: ["app-settings"],
		queryFn: fetchSettings,
	});
	const raw = settings?.["ui.readerActions"];
	const order: string[] = Array.isArray(raw) ? raw : [...READER_ACTION_ORDER];
	const rawInMore = settings?.["ui.readerActionsInMore"];
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
	const displayOrder = (localOrder ?? order).filter(
		(id): id is ReaderActionId =>
			(READER_ACTION_ORDER as readonly string[]).includes(id),
	);

	const reorder = (from: number, to: number) => {
		if (from === to) return;
		const next = [...displayOrder];
		const [moved] = next.splice(from, 1);
		if (moved === undefined) return;
		next.splice(to, 0, moved);
		setLocalOrder(next);
		patch.mutate({ "ui.readerActions": next });
	};

	const toggleInMore = (id: string, on: boolean) => {
		const set = new Set(inMore);
		if (on) set.add(id);
		else set.delete(id);
		patch.mutate({ "ui.readerActionsInMore": [...set] });
	};

	return (
		<GhostCard>
			<h2 className="mb-2 flex items-center gap-2 font-headline text-headline-md text-primary dark:text-primary-fixed">
				<Icon name="more_vert" className="text-[24px]" />
				{t("settings.readerActionsTitle")}
			</h2>
			<p className="mb-2 font-body text-body-sm text-on-surface-variant">
				{t("settings.readerActionsHint")}
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
					const action = id as ReaderActionId;
					// ON = in the reader bar; OFF = behind "More ⋮" (v1.8.1 — the
					// switch reads naturally, not inverted).
					const on = !inMore.includes(id);
					return (
						<div className="flex items-center gap-2 py-1">
							<Icon
								name="drag_indicator"
								className="cursor-grab text-[20px] text-on-surface-variant"
							/>
							<div className="flex-1">
								<Toggle
									icon={readerActionIcon(action)}
									label={readerActionLabel(t, action)}
									hint={
										on ? t("settings.readerInBar") : t("settings.readerInMore")
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
