import { useTranslation } from "react-i18next";
import { GhostCard } from "@/components/ui/GhostCard";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { VORYNTH_VERSION } from "@vorynth/types";
import { useUpdaterStore } from "./updater-store.js";
import { isTauriShell } from "@/features/plugins/plugins-folder.js";

/**
 * Updates section (v1.8.0) — the manual update surface in Settings.
 *
 * Shows the running version, the last time an update check ran, and a
 * "Check for updates" button that works even in dev (it reports "up to date"
 * while the dev version is newer than the latest release — the negative
 * path). The Download & install action is offered only in the packaged app,
 * where self-replacement is safe.
 */
export function UpdatesSection() {
	const { t } = useTranslation();
	const phase = useUpdaterStore((s) => s.phase);
	const packaged = useUpdaterStore((s) => s.packaged);
	const lastChecked = useUpdaterStore((s) => s.lastChecked);
	const version = useUpdaterStore((s) => s.available?.version);
	const check = useUpdaterStore((s) => s.check);
	const install = useUpdaterStore((s) => s.install);

	const checking = phase.kind === "checking";
	const percent = phase.kind === "downloading" ? phase.percent : null;

	return (
		<GhostCard>
			<h3 className="mb-2 flex items-center gap-2 font-label text-label-md uppercase tracking-widest text-on-surface-variant">
				<Icon name="system_update" className="text-base" />
				{t("settings.updatesTitle")}
			</h3>
			<p className="mb-4 font-body text-body-md text-on-surface-variant">
				{t("settings.updatesHint")}
			</p>

			<div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-2">
				<div className="border-s-2 border-s-outline-variant ps-3">
					<p className="font-label text-label-sm uppercase tracking-widest text-on-tertiary-container">
						{t("settings.updatesCurrent")}
					</p>
					<p className="mt-1 font-mono text-mono-technical text-on-surface">
						v{VORYNTH_VERSION}
					</p>
				</div>
				<div className="border-s-2 border-s-outline-variant ps-3">
					<p className="font-label text-label-sm uppercase tracking-widest text-on-tertiary-container">
						{t("settings.updatesLastChecked")}
					</p>
					<p className="mt-1 font-mono text-mono-technical text-on-surface">
						{lastChecked
							? new Date(lastChecked).toLocaleString()
							: t("settings.updatesNever")}
					</p>
				</div>
			</div>

			<div className="flex flex-wrap items-center gap-3">
				<Button
					variant="secondary"
					size="sm"
					icon="system_update"
					onClick={() => void check()}
					disabled={checking}
				>
					{checking
						? t("settings.updatesChecking")
						: t("settings.updatesCheck")}
				</Button>

				{phase.kind === "uptodate" ? (
					<span className="flex items-center gap-1.5 font-label text-label-sm text-secondary">
						<Icon name="check_circle" className="text-[16px]" />
						{t("settings.updatesUpToDate")}
					</span>
				) : null}

				{phase.kind === "available" ? (
					<Button
						size="sm"
						icon="system_update"
						disabled={!packaged}
						onClick={() => void install()}
					>
						{t("settings.updatesInstall", { version })}
					</Button>
				) : null}
			</div>

			{phase.kind === "downloading" ? (
				<div className="mt-3 flex items-center gap-2">
					<div
						role="progressbar"
						aria-valuemin={0}
						aria-valuemax={100}
						aria-valuenow={percent ?? 0}
						className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-container-lowest"
					>
						<div
							className="h-full rounded-full bg-primary transition-all"
							style={{ width: `${percent ?? 0}%` }}
						/>
					</div>
					<span className="font-mono text-mono-technical text-on-surface-variant">
						{percent !== null ? `${percent}%` : "…"}
					</span>
				</div>
			) : null}

			{phase.kind === "installing" ? (
				<p className="mt-3 flex items-center gap-2 font-label text-label-sm text-on-surface-variant">
					<Icon name="sync" className="animate-spin-reverse text-[16px]" />
					{t("updates.bannerInstalling")}
				</p>
			) : null}

			{phase.kind === "error" ? (
				<p className="mt-3 font-body text-body-sm text-error">
					{t("settings.updatesError")} {phase.message}
				</p>
			) : null}

			{!packaged && isTauriShell() ? (
				<p className="mt-3 flex items-start gap-1.5 font-body text-body-sm text-on-surface-variant">
					<Icon name="info" className="mt-0.5 shrink-0 text-[14px]" />
					{t("settings.updatesDevHint")}
				</p>
			) : null}
		</GhostCard>
	);
}
