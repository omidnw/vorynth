import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useUpdaterStore } from "./updater-store.js";
import { isTauriShell } from "@/features/plugins/plugins-folder.js";

/**
 * Global update banner (v1.8.0) — the "a new version is available" surface.
 *
 * Mounted once at the app root. In the packaged app it checks GitHub releases
 * on boot and every 6 hours (silently — the store's `check` is a single GET);
 * when a newer version exists it slides in a top banner with Download &
 * Install. The plugin then downloads, verifies, and hands the install to a
 * detached updater process that closes this app, replaces it, relaunches it,
 * and cleans up — the user never has to touch the installer file.
 *
 * In dev / plain browser nothing is checked (the store's `check` is a no-op
 * outside the Tauri shell, and `packaged` gates the whole flow).
 */
export function UpdateBanner() {
	const { t } = useTranslation();
	const phase = useUpdaterStore((s) => s.phase);
	const version = useUpdaterStore((s) => s.available?.version);
	const init = useUpdaterStore((s) => s.init);
	const install = useUpdaterStore((s) => s.install);
	const dismiss = useUpdaterStore((s) => s.dismiss);

	useEffect(() => {
		if (!isTauriShell()) return;
		void init();
		const interval = setInterval(() => void init(), 6 * 60 * 60 * 1000);
		return () => clearInterval(interval);
	}, [init]);

	// Only the banners worth the user's attention render: an update to grab or
	// a download in progress. Check failures ("no manifest yet", offline, …)
	// stay silent here — the Settings Updates section surfaces them with a
	// retry button, so a background check hiccup never blocks the app on boot.
	if (
		phase.kind !== "available" &&
		phase.kind !== "downloading" &&
		phase.kind !== "installing"
	) {
		return null;
	}

	const percent = phase.kind === "downloading" ? phase.percent : null;

	return (
		<div
			role="status"
			className="fixed inset-x-0 top-0 z-50 border-b border-outline-variant bg-surface-container-high px-4 py-3 shadow-lg"
		>
			<div className="mx-auto flex w-full max-w-max-content-width flex-wrap items-center gap-3">
				<Icon name="system_update" className="text-primary" />
				<div className="min-w-0 flex-1">
					<p className="font-label text-label-md text-on-surface">
						{t("updates.bannerTitle", { version })}
					</p>
					{phase.kind === "downloading" ? (
						<div className="mt-1 flex items-center gap-2">
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
						<p className="font-body text-body-sm text-on-surface-variant">
							{t("updates.bannerInstalling")}
						</p>
					) : null}
				</div>
				<div className="flex items-center gap-2">
					{phase.kind === "available" ? (
						<Button
							size="sm"
							icon="system_update"
							onClick={() => void install()}
						>
							{t("updates.bannerAction")}
						</Button>
					) : null}
					{phase.kind === "downloading" || phase.kind === "installing" ? (
						<span className="flex items-center gap-2 font-label text-label-sm text-on-surface-variant">
							<Icon name="sync" className="animate-spin-reverse text-[16px]" />
							{phase.kind === "installing"
								? t("updates.bannerInstalling")
								: t("updates.bannerDownloading")}
						</span>
					) : null}
					{phase.kind === "available" ? (
						<button
							type="button"
							onClick={dismiss}
							className="p-2 text-on-surface-variant hover:text-on-surface"
							aria-label={t("updates.bannerDismiss")}
						>
							<Icon name="close" className="text-[18px]" />
						</button>
					) : null}
				</div>
			</div>
		</div>
	);
}
