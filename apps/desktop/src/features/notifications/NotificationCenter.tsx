import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { fetchSettings } from "@/features/history/history-api.js";
import {
	unreadCount,
	useNotificationsStore,
	type AppNotification,
} from "./notifications-store.js";

/**
 * Notification center (v1.8.0) — the bell in the top bar, to the right of the
 * theme changer. Opens an animated dropdown of in-app notifications (job
 * results, new-version pings). Also syncs the `notifications.*` persisted
 * settings into the store so the watchers know what's on.
 */
export function NotificationCenter({
	showLabel = false,
}: {
	/** v1.8.1 — show a text label next to the bell (header labels setting). */
	showLabel?: boolean;
}) {
	const { t } = useTranslation();
	const [open, setOpen] = useState(false);
	const items = useNotificationsStore((s) => s.items);
	const markAllRead = useNotificationsStore((s) => s.markAllRead);
	const clear = useNotificationsStore((s) => s.clear);
	const applySettings = useNotificationsStore((s) => s.applySettings);
	const ref = useRef<HTMLDivElement>(null);

	// Keep the persisted notification settings in sync (the Notifications
	// settings section writes the same keys; this applies them app-wide).
	const { data: settings } = useQuery({
		queryKey: ["app-settings"],
		queryFn: fetchSettings,
	});
	useEffect(() => {
		if (!settings) return;
		applySettings({
			enabled:
				(settings["notifications.enabled"] as boolean | undefined) ?? true,
			osEnabled:
				(settings["notifications.osEnabled"] as boolean | undefined) ?? false,
			jobFinished:
				(settings["notifications.jobFinished"] as boolean | undefined) ?? true,
			updateAvailable:
				(settings["notifications.updateAvailable"] as boolean | undefined) ??
				true,
		});
	}, [settings, applySettings]);

	// Click-outside closes the dropdown.
	useEffect(() => {
		if (!open) return;
		const onPointer = (e: PointerEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node))
				setOpen(false);
		};
		window.addEventListener("pointerdown", onPointer);
		return () => window.removeEventListener("pointerdown", onPointer);
	}, [open]);

	const count = unreadCount(items);

	return (
		<div ref={ref} className="relative">
			<button
				type="button"
				onClick={() => setOpen((o) => !o)}
				aria-label={t("notifications.aria")}
				aria-expanded={open}
				className="relative flex items-center gap-1.5 rounded p-2 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
			>
				{/* v1.8.1 — the badge sits on the ICON (like a phone/dock badge),
				    not next to the text label. */}
				<span className="relative inline-flex">
					<Icon name="notifications" className="text-[24px]" />
					{count > 0 ? (
						<span className="absolute end-[-4px] top-[-4px] flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 font-mono text-[10px] font-bold leading-none text-on-error">
							{count > 9 ? "9+" : count}
						</span>
					) : null}
				</span>
				{showLabel ? (
					<span className="hidden font-label text-label-sm md:inline">
						{t("notifications.title")}
					</span>
				) : null}
			</button>

			{open ? (
				<div className="absolute end-0 top-full z-50 mt-2 w-[430px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-outline-variant bg-surface-container shadow-2xl">
					<div className="flex items-center justify-between gap-2 border-b border-outline-variant px-4 py-3">
						<h3 className="font-label text-label-md uppercase tracking-widest text-on-surface">
							{t("notifications.title")}
						</h3>
						<div className="flex items-center gap-1">
							{count > 0 ? (
								<Button
									variant="ghost"
									size="sm"
									icon="done_all"
									onClick={markAllRead}
								>
									{t("notifications.markAllRead")}
								</Button>
							) : null}
							{items.length > 0 ? (
								<Button
									variant="ghost"
									size="sm"
									icon="delete_sweep"
									onClick={clear}
								>
									{t("notifications.clear")}
								</Button>
							) : null}
						</div>
					</div>
					<div className="max-h-[60vh] overflow-y-auto">
						{items.length === 0 ? (
							<p className="px-4 py-8 text-center font-body text-body-md text-on-surface-variant">
								{t("notifications.empty")}
							</p>
						) : (
							<ul className="divide-y divide-outline-variant">
								{items.map((n) => (
									<NotificationRow key={n.id} n={n} />
								))}
							</ul>
						)}
					</div>
				</div>
			) : null}
		</div>
	);
}

function NotificationRow({ n }: { n: AppNotification }) {
	const { t } = useTranslation();
	const markRead = useNotificationsStore((s) => s.markRead);
	const icon =
		n.kind === "job"
			? "task_alt"
			: n.kind === "update"
				? "system_update"
				: "info";

	return (
		<li className={n.read ? "opacity-60" : undefined}>
			<button
				type="button"
				onClick={() => markRead(n.id)}
				className="flex w-full items-start gap-3 px-4 py-3 text-start transition-colors hover:bg-surface-container-low"
			>
				<Icon
					name={icon}
					className={
						n.kind === "job"
							? "mt-0.5 text-[18px] text-secondary"
							: n.kind === "update"
								? "mt-0.5 text-[18px] text-primary"
								: "mt-0.5 text-[18px] text-on-surface-variant"
					}
				/>
				<span className="min-w-0 flex-1">
					<span className="block truncate font-label text-label-md text-on-surface">
						{n.title}
					</span>
					<span className="block truncate font-body text-body-sm text-on-surface-variant">
						{n.body}
					</span>
					<span className="mt-0.5 block font-mono text-[11px] text-on-tertiary-container">
						{relativeTime(n.time, t)}
					</span>
				</span>
				{!n.read ? (
					<span
						className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary"
						aria-label={t("notifications.unread")}
					/>
				) : null}
			</button>
		</li>
	);
}

function relativeTime(iso: string, t: TFunction): string {
	const diff = Date.now() - new Date(iso).getTime();
	const mins = Math.floor(diff / 60_000);
	if (mins < 1) return t("notifications.justNow");
	if (mins < 60) return t("notifications.minutesAgo", { count: mins });
	const hours = Math.floor(mins / 60);
	if (hours < 24) return t("notifications.hoursAgo", { count: hours });
	const days = Math.floor(hours / 24);
	return t("notifications.daysAgo", { count: days });
}
