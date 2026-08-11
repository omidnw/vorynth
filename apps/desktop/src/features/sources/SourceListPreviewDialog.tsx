import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/ui/Icon";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import type { SourceListSourcePreview } from "@vorynth/types";

/**
 * Sources preview modal (v1.8.1) — "see what the sites are" before enabling a
 * curated list (or while browsing the catalog). Lists the list's cached
 * definitions: site name, URL, category, adapter, and whether the source is
 * currently enabled (false for a list that hasn't been materialized yet).
 *
 * Same visual language as ConfirmDialog: centered overlay, fade/scale-in,
 * scroll lock, Escape + backdrop close, `role="dialog"` (R-A12/R-D08).
 */
export function SourceListPreviewDialog({
	open,
	listName,
	sources,
	loading,
	onClose,
}: {
	open: boolean;
	listName: string;
	sources: SourceListSourcePreview[];
	loading: boolean;
	onClose: () => void;
}) {
	const { t } = useTranslation();

	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open, onClose]);

	useBodyScrollLock(open);

	if (!open) return null;

	return (
		<div
			className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-6 backdrop-blur-[1px] animate-fade-in"
			role="dialog"
			aria-modal="true"
			aria-labelledby="source-list-preview-title"
			onClick={(e) => {
				if (e.target === e.currentTarget) onClose();
			}}
		>
			<div className="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-outline-variant bg-surface-container shadow-2xl animate-scale-in">
				{/* v1.8.1 — explicit close button, top-end (right in LTR, left in RTL). */}
				<button
					type="button"
					onClick={onClose}
					aria-label={t("settings.close")}
					title={t("settings.close")}
					className="absolute end-3 top-3 z-10 rounded p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-primary"
				>
					<Icon name="close" className="text-[20px]" />
				</button>
				<div className="mb-4 flex items-start gap-4 p-6 pb-0">
					<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
						<Icon name="visibility" className="text-[20px]" />
					</span>
					<div className="min-w-0">
						<h2
							id="source-list-preview-title"
							className="font-headline text-headline-sm text-on-surface"
						>
							{t("sourceLists.previewTitle", { name: listName })}
						</h2>
						<p className="mt-1 font-body text-body-sm text-on-surface-variant">
							{t("sourceLists.previewBody", {
								count: loading ? "…" : sources.length,
							})}
						</p>
					</div>
				</div>

				<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6">
					{loading ? (
						<p className="font-body text-body-md text-on-surface-variant">
							{t("sourceLists.previewLoading")}
						</p>
					) : sources.length === 0 ? (
						<p className="font-body text-body-md text-on-surface-variant">
							{t("sourceLists.previewEmpty")}
						</p>
					) : (
						<ul className="divide-y divide-outline-variant">
							{sources.map((s) => (
								<li key={s.id} className="flex items-center gap-3 py-3">
									<span
										className={`h-2 w-2 shrink-0 rounded-full ${
											s.enabled ? "bg-secondary" : "bg-outline-variant"
										}`}
										title={
											s.enabled
												? t("sourceLists.previewOn")
												: t("sourceLists.previewOff")
										}
									/>
									<div className="min-w-0 flex-1">
										<p className="truncate font-label text-label-md text-on-surface">
											{s.name}
										</p>
										<a
											href={s.url}
											target="_blank"
											rel="noopener noreferrer"
											className="truncate font-mono text-[11px] text-on-tertiary-container hover:text-primary"
										>
											{s.url}
										</a>
									</div>
									<div className="flex shrink-0 flex-col items-end gap-1">
										<span className="font-mono text-[10px] uppercase tracking-wider text-on-tertiary-container">
											{s.category}
										</span>
										<span className="font-mono text-[10px] text-on-surface-variant">
											{s.adapter}
										</span>
									</div>
								</li>
							))}
						</ul>
					)}
				</div>
			</div>
		</div>
	);
}
