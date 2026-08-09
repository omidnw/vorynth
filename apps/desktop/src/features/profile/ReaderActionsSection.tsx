import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { GhostCard } from "@/components/ui/GhostCard";
import { Icon } from "@/components/ui/Icon";
import { Toggle } from "@/components/ui/Toggle";
import {
	fetchSettings,
	patchSettings,
} from "@/features/history/history-api.js";
import {
	DEFAULT_PINNED_ACTIONS,
	READER_ACTION_ORDER,
	readerActionIcon,
	readerActionLabel,
	type ReaderActionId,
} from "@/features/reader/reader-actions.js";

/**
 * Profile → Reader actions (v1.8.0).
 *
 * Choose which story-reader footer actions stay in the primary bar; the rest
 * sit behind the "More ⋮" menu — nothing is hidden, the bar just stays
 * uncluttered. Persisted to `ui.readerPinnedActions` (app_settings, JSON array
 * of action ids).
 */
export function ReaderActionsSection() {
	const { t } = useTranslation();
	const queryClient = useQueryClient();
	const { data: settings } = useQuery({
		queryKey: ["app-settings"],
		queryFn: fetchSettings,
	});
	const raw = settings?.["ui.readerPinnedActions"];
	const pinned: string[] = Array.isArray(raw) ? raw : DEFAULT_PINNED_ACTIONS;

	const patch = useMutation({
		mutationFn: (p: Record<string, unknown>) => patchSettings(p),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: ["app-settings"] }),
	});

	const setPinned = (id: ReaderActionId, on: boolean) => {
		const next = on
			? [...new Set([...pinned, id])]
			: pinned.filter((p) => p !== id);
		patch.mutate({ "ui.readerPinnedActions": next });
	};

	return (
		<GhostCard>
			<h2 className="mb-2 flex items-center gap-2 font-headline text-headline-md text-primary dark:text-primary-fixed">
				<Icon name="more_vert" className="text-[24px]" />
				{t("profile.readerActions")}
			</h2>
			<p className="mb-2 font-body text-body-sm text-on-surface-variant">
				{t("profile.readerActionsHint")}
			</p>
			<div className="divide-y divide-outline-variant">
				{READER_ACTION_ORDER.map((id) => {
					const on = pinned.includes(id);
					return (
						<Toggle
							key={id}
							icon={readerActionIcon(id)}
							label={readerActionLabel(t, id)}
							hint={on ? t("profile.pinned") : t("profile.moreMenu")}
							checked={on}
							onChange={(v) => setPinned(id, v)}
						/>
					);
				})}
			</div>
			{pinned.length > 5 ? (
				<p
					className="mt-3 flex items-start gap-1.5 font-body text-body-sm text-on-surface-variant"
					dir="auto"
				>
					<Icon name="info" className="mt-0.5 shrink-0 text-[14px]" />
					<span>{t("profile.readerActionsOverflow")}</span>
				</p>
			) : null}
		</GhostCard>
	);
}
