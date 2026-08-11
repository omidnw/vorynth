import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Icon } from "./Icon";
import { cn } from "@/lib/cn";
import {
	fetchSettings,
	patchSettings,
} from "@/features/history/history-api.js";

/**
 * Dismissible guidance (v1.8.1) — a contextual tip with a "Don't show this
 * again" action, persisted in `ui.tipsDismissed` (an array of tip ids). Use it
 * where a first-time user could get lost; never for repeated/mandatory info.
 */
export function DismissibleTip({
	id,
	icon = "tips_and_updates",
	children,
	className,
}: {
	/** Unique tip id — persisted in `ui.tipsDismissed`. */
	id: string;
	/** Material Symbols icon name. Defaults to "tips_and_updates". */
	icon?: string;
	children: ReactNode;
	className?: string;
}) {
	const { t } = useTranslation();
	const queryClient = useQueryClient();
	const { data: settings } = useQuery({
		queryKey: ["app-settings"],
		queryFn: fetchSettings,
	});
	const dismissed =
		(settings?.["ui.tipsDismissed"] as string[] | undefined) ?? [];
	const patch = useMutation({
		mutationFn: (ids: string[]) => patchSettings({ "ui.tipsDismissed": ids }),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: ["app-settings"] }),
	});

	if (dismissed.includes(id)) return null;

	return (
		<div
			className={cn(
				"flex items-start gap-3 rounded border-s-2 border-s-secondary bg-surface-container-low p-4",
				className,
			)}
		>
			<Icon
				name={icon}
				className="mt-0.5 shrink-0 text-[18px] text-secondary"
			/>
			<div className="min-w-0 flex-1 font-body text-body-sm leading-relaxed text-on-surface-variant">
				{children}
			</div>
			<button
				type="button"
				onClick={() => patch.mutate([...dismissed, id])}
				className="shrink-0 font-label text-label-sm uppercase tracking-wider text-on-tertiary-container transition-colors hover:text-primary"
			>
				{t("common.dontShowAgain")}
			</button>
		</div>
	);
}
