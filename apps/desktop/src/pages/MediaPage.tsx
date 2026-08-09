import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
	fetchLocalMediaSummary,
	purgeLocalMedia,
	releaseArticleMedia,
	fetchLocalMediaFile,
} from "@/features/reader/reader-api";
import { fetchSettings, patchSettings } from "@/features/history/history-api";
import { CORE_BASE_URL } from "@/lib/api/config";
import { usePluginConfig } from "@/plugins/plugin-hooks";
import {
	buildAttributionText,
	drawAttributionBar,
	downloadBlob,
	extFromUrl,
	fileStem,
} from "@/features/media/attribution";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { GhostCard } from "@/components/ui/GhostCard";
import { ArchiveLayout } from "@/components/shell/ArchiveLayout.js";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useTranslation } from "react-i18next";
import type { LocalMediaArticle, LocalMediaItem } from "@vorynth/types";

/**
 * Media storage dashboard (v1.1.0).
 *
 * The decision surface the user asked for: every article with locally-kept
 * media is listed with its size, source, and date, plus the controls to
 * release the local copy or purge everything. Media is never stored without
 * explicit opt-in (per-item on the article reader), so this page only ever
 * shows what the user consciously chose to keep.
 *
 * Since v1.8.0 each kept item can also be downloaded — either with a copyright
 * attribution bar drawn into the image (the blog, article title, and source
 * URL) or as the original file. A one-time privacy/policy disclaimer precedes
 * the first download and can be re-enabled from Settings.
 */

interface DownloadAction {
	article: LocalMediaArticle;
	item: LocalMediaItem;
	withAttribution: boolean;
}

export function MediaPage() {
	const { t } = useTranslation();
	const queryClient = useQueryClient();
	const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);
	/** Kept-item id whose download menu is open. */
	const [menuFor, setMenuFor] = useState<string | null>(null);
	/** Kept-item previewed full-size in the zoom overlay. */
	const [zoomed, setZoomed] = useState<LocalMediaItem | null>(null);
	/** A download choice waiting for the one-time disclaimer. */
	const [pendingAction, setPendingAction] = useState<DownloadAction | null>(
		null,
	);
	/** Kept-item id currently downloading. */
	const [downloading, setDownloading] = useState<string | null>(null);
	const [downloadError, setDownloadError] = useState(false);

	const { data: summary, isLoading } = useQuery({
		queryKey: ["media-local"],
		queryFn: fetchLocalMediaSummary,
	});

	const { data: settings } = useQuery({
		queryKey: ["app-settings"],
		queryFn: fetchSettings,
	});
	const showWarning = settings?.["media.showDownloadWarning"] !== false;

	// The Copyright & Attribution plugin's default (v1.8.0): attribution first
	// in the per-item menu unless the plugin's setting turns it off. The menu
	// always offers both choices — the plugin only picks the primary one.
	const { config: copyrightConfig } = usePluginConfig("media-copyright");
	const attributionDefault = copyrightConfig["includeAttribution"] !== false;

	const releaseOne = useMutation({
		mutationFn: (articleId: string) => releaseArticleMedia(articleId),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: ["media-local"] }),
	});
	const purgeAll = useMutation({
		mutationFn: () => purgeLocalMedia(),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: ["media-local"] }),
	});

	/** Actually download — after the disclaimer (if any) has been accepted. */
	async function runDownload(action: DownloadAction) {
		const { article, item, withAttribution } = action;
		setMenuFor(null);
		setDownloading(item.id);
		setDownloadError(false);
		try {
			const blob = await fetchLocalMediaFile(item.id);
			const stem = fileStem(article.articleTitle, item.caption);
			if (withAttribution && item.kind === "image") {
				const image = await createImageBitmap(blob);
				// Credit cites the ORIGINAL published title — when the story was
				// translated, `articleTitle` holds the translation and the true
				// title lives in `articleOriginalTitle` (R-A05).
				const creditTitle =
					article.articleOriginalTitle ?? article.articleTitle;
				const text = buildAttributionText({
					sourceName: article.sourceName,
					creditTitle,
					sourceUrl: article.articleUrl,
					noSourceLabel: t("media.unknownSource"),
					dateLabel: new Date().toLocaleDateString(),
					labels: {
						copyright: t("attribution.copyright"),
						source: t("attribution.source"),
						downloadedVia: t("media.viaVorynth"),
					},
				});
				const credited = await drawAttributionBar(image, text);
				downloadBlob(credited, `${stem}-credit.png`);
			} else {
				downloadBlob(blob, `${stem}.${extFromUrl(item.url, item.mime)}`);
			}
		} catch (err) {
			console.error("media download failed", err);
			setDownloadError(true);
		} finally {
			setDownloading(null);
		}
	}

	/** Entry point for a menu choice — gates on the one-time disclaimer. */
	function requestDownload(item: LocalMediaItem, withAttribution: boolean) {
		const article = summary?.articles.find((a) =>
			a.items.some((i) => i.id === item.id),
		);
		if (!article) return;
		const action: DownloadAction = { article, item, withAttribution };
		setMenuFor(null);
		if (showWarning) {
			setPendingAction(action);
		} else {
			void runDownload(action);
		}
	}

	return (
		<ArchiveLayout
			title={t("media.title")}
			subtitle={t("media.subtitle")}
			docsSectionId="media"
		>
			{/* Summary card. */}
			<GhostCard className="mb-8">
				<div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
					<Stat
						label={t("media.totalSize")}
						value={summary ? formatBytes(summary.totalBytes) : "—"}
					/>
					<Stat
						label={t("media.articles")}
						value={summary ? String(summary.articles.length) : "—"}
					/>
					<Stat
						label={t("media.items")}
						value={summary ? String(summary.totalItems) : "—"}
					/>
				</div>
			</GhostCard>

			{/* Empty / loading / list. */}
			{isLoading ? (
				<p className="font-body text-body-md text-on-surface-variant">
					{t("media.loading")}
				</p>
			) : !summary || summary.articles.length === 0 ? (
				<GhostCard className="flex flex-col items-center gap-4 text-center">
					<Icon
						name="cloud_download"
						className="text-[40px] text-on-tertiary-container"
					/>
					<h2 className="font-headline text-headline-md text-primary">
						{t("media.empty")}
					</h2>
					<p className="max-w-md font-body text-body-md text-on-surface-variant">
						{t("media.emptyBody")}
					</p>
				</GhostCard>
			) : (
				<>
					<div className="mb-6 flex justify-end">
						<Button
							variant="ghost"
							icon="delete_forever"
							onClick={() => setShowPurgeConfirm(true)}
						>
							{t("media.purgeAll")}
						</Button>
					</div>
					<ConfirmDialog
						open={showPurgeConfirm}
						title={t("media.purgeAll")}
						message={t("media.purgeConfirm")}
						confirmLabel={t("media.purgeAll")}
						cancelLabel={t("common.cancel")}
						icon="delete_forever"
						danger
						confirming={purgeAll.isPending}
						onConfirm={() => {
							setShowPurgeConfirm(false);
							purgeAll.mutate();
						}}
						onCancel={() => setShowPurgeConfirm(false)}
					/>
					{downloadError ? (
						<p className="mb-4 font-body text-body-sm text-error">
							{t("media.downloadFailed")}
						</p>
					) : null}
					{/* Click-outside layer for the open download menu. */}
					{menuFor ? (
						<div
							className="fixed inset-0 z-10"
							onClick={() => setMenuFor(null)}
						/>
					) : null}
					<div className="space-y-3">
						{summary.articles.map((a) => (
							<GhostCard key={a.articleId}>
								<div className="flex flex-wrap items-center gap-4">
									<Link
										to={`/articles/${a.articleId}`}
										className="min-w-0 flex-1"
									>
										<h3 className="truncate font-headline text-headline-sm text-on-surface hover:text-primary">
											{a.articleTitle}
										</h3>
										<div className="mt-1 flex flex-wrap items-center gap-3 font-mono text-[11px] text-on-tertiary-container">
											<span>{a.sourceName ?? t("media.unknownSource")}</span>
											<span>
												· {new Date(a.collectedAt).toLocaleDateString()}
											</span>
											<span>
												· {a.itemCount} {t("media.itemsUnit")}
											</span>
										</div>
									</Link>
									<span className="font-mono text-mono-technical text-primary">
										{formatBytes(a.bytes)}
									</span>
									<Button
										variant="ghost"
										size="sm"
										icon="delete_sweep"
										onClick={() => releaseOne.mutate(a.articleId)}
									>
										{t("media.release")}
									</Button>
								</div>
								<div className="mt-4 divide-y divide-outline-variant border-t border-outline-variant">
									{a.items.map((item) => (
										<MediaItemRow
											key={item.id}
											item={item}
											menuOpen={menuFor === item.id}
											downloading={downloading === item.id}
											attributionDefault={attributionDefault}
											onZoom={() => setZoomed(item)}
											onToggleMenu={() =>
												setMenuFor((cur) => (cur === item.id ? null : item.id))
											}
											onChoose={(withAttribution) =>
												requestDownload(item, withAttribution)
											}
										/>
									))}
								</div>
							</GhostCard>
						))}
					</div>

					{/* One-time download disclaimer — "don't show again" persists and
					    can be re-enabled in Settings → Media. */}
					<ConfirmDialog
						open={pendingAction !== null}
						title={t("media.downloadDisclaimerTitle")}
						message={t("media.downloadDisclaimerBody")}
						confirmLabel={t("media.download")}
						cancelLabel={t("common.cancel")}
						icon="privacy_tip"
						danger={false}
						dontShowAgain
						onConfirm={(dontShowAgain) => {
							const action = pendingAction;
							setPendingAction(null);
							if (dontShowAgain) {
								void patchSettings({
									"media.showDownloadWarning": false,
								}).then(() =>
									queryClient.invalidateQueries({
										queryKey: ["app-settings"],
									}),
								);
							}
							if (action) void runDownload(action);
						}}
						onCancel={() => setPendingAction(null)}
					/>

					{/* Zoom overlay — the kept item's real bytes, full size. */}
					{zoomed ? (
						<div
							className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-6"
							onClick={(e) => {
								if (e.target === e.currentTarget) setZoomed(null);
							}}
						>
							<button
								className="absolute end-6 top-6 text-on-surface-variant transition-colors hover:text-primary"
								onClick={() => setZoomed(null)}
								aria-label={t("media.close")}
							>
								<Icon name="close" className="text-[28px]" />
							</button>
							{zoomed.kind === "image" ? (
								<img
									src={mediaFileUrl(zoomed.id)}
									alt={zoomed.caption ?? ""}
									className="max-h-[85vh] max-w-[90vw] rounded object-contain"
								/>
							) : (
								<video
									src={mediaFileUrl(zoomed.id)}
									controls
									className="max-h-[85vh] max-w-[90vw] rounded"
								/>
							)}
						</div>
					) : null}
				</>
			)}
		</ArchiveLayout>
	);
}

function MediaItemRow({
	item,
	menuOpen,
	downloading,
	attributionDefault,
	onZoom,
	onToggleMenu,
	onChoose,
}: {
	item: LocalMediaItem;
	menuOpen: boolean;
	downloading: boolean;
	attributionDefault: boolean;
	onZoom: () => void;
	onToggleMenu: () => void;
	onChoose: (withAttribution: boolean) => void;
}) {
	const { t } = useTranslation();
	const kindLabel = item.kind === "image" ? t("media.image") : t("media.video");

	return (
		<div className="relative flex items-center gap-3 py-3">
			{/* Real preview of the kept bytes — the image as a clickable thumbnail
			    (opens the zoom overlay), the video as an inline player. */}
			{item.kind === "image" ? (
				<button
					type="button"
					onClick={onZoom}
					className="h-16 w-16 flex-none overflow-hidden rounded bg-black/5 transition-opacity hover:opacity-90"
					aria-label={t("media.previewAria", {
						caption: item.caption || kindLabel,
					})}
				>
					<img
						src={mediaFileUrl(item.id)}
						alt={item.caption ?? kindLabel}
						loading="lazy"
						className="h-full w-full object-cover"
					/>
				</button>
			) : (
				<video
					src={mediaFileUrl(item.id)}
					controls
					preload="metadata"
					className="h-16 w-24 flex-none rounded bg-black object-contain"
				/>
			)}
			<div className="min-w-0 flex-1">
				<p className="truncate font-body text-body-md text-on-surface">
					{item.caption || kindLabel}
				</p>
				<p className="font-mono text-[11px] text-on-tertiary-container dir-ltr-isolate">
					{kindLabel} · {item.mime ?? "—"} · {formatBytes(item.bytes ?? 0)}
				</p>
			</div>
			<button
				type="button"
				onClick={onToggleMenu}
				disabled={downloading}
				className="inline-flex items-center gap-1.5 rounded border border-outline-variant px-2.5 py-1 font-label text-label-md text-on-surface-variant transition-colors hover:border-secondary hover:text-secondary disabled:opacity-60"
				aria-label={t("media.downloadAria", {
					caption: item.caption || kindLabel,
				})}
				aria-haspopup="menu"
				aria-expanded={menuOpen}
			>
				{downloading ? (
					<span className="h-3.5 w-3.5 animate-spin-reverse rounded-full border-2 border-current border-t-transparent" />
				) : (
					<Icon name="download" className="text-[16px]" />
				)}
				{t("media.download")}
			</button>

			{menuOpen ? (
				<div
					role="menu"
					className="absolute end-0 top-full z-20 mt-1 w-80 rounded-lg border border-outline-variant bg-surface p-1.5 shadow-xl"
				>
					{menuOptions(item, attributionDefault, t, onChoose).map((opt) => (
						<button
							key={opt.label}
							type="button"
							role="menuitem"
							onClick={opt.onClick}
							className="flex w-full items-start gap-3 rounded-md p-3 text-start transition-colors hover:bg-surface-container-high"
						>
							<span className="mt-0.5 flex-none text-on-surface-variant">
								<Icon name={opt.icon} className="text-[18px]" />
							</span>
							<span className="min-w-0 flex-1">
								<span className="block font-label text-label-md text-on-surface">
									{opt.label}
								</span>
								<span className="block font-body text-body-sm text-on-surface-variant">
									{opt.hint}
								</span>
							</span>
						</button>
					))}
				</div>
			) : null}
		</div>
	);
}

function menuOptions(
	item: LocalMediaItem,
	attributionDefault: boolean,
	t: (key: string, opts?: Record<string, unknown>) => string,
	onChoose: (withAttribution: boolean) => void,
): { icon: string; label: string; hint: string; onClick: () => void }[] {
	if (item.kind !== "image") {
		return [
			{
				icon: "file_download",
				label: t("media.downloadOriginal"),
				hint: t("media.videoDownloadsAsIs"),
				onClick: () => onChoose(false),
			},
		];
	}
	const attributed = {
		icon: "copyright",
		label: t("media.downloadWithAttribution"),
		hint: t("media.downloadWithAttributionHint"),
		onClick: () => onChoose(true),
	};
	const original = {
		icon: "file_download",
		label: t("media.downloadOriginal"),
		hint: t("media.downloadOriginalHint"),
		onClick: () => onChoose(false),
	};
	return attributionDefault ? [attributed, original] : [original, attributed];
}

/**
 * The engine's endpoint that streams a kept media item's local bytes. Used
 * directly as the `<img>`/`<video>` source for previews and the zoom overlay —
 * the engine is local, so previews work fully offline without any blob dance.
 */
function mediaFileUrl(itemId: string): string {
	return `${CORE_BASE_URL}/media/local/${encodeURIComponent(itemId)}/file`;
}

function Stat({ label, value }: { label: string; value: string }) {
	return (
		<div className="text-center">
			<div className="font-headline text-display-md leading-none text-primary dark:text-primary-fixed">
				{value}
			</div>
			<div className="mt-2 font-label text-label-sm uppercase tracking-widest text-on-surface-variant">
				{label}
			</div>
		</div>
	);
}

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	if (bytes < 1024 * 1024 * 1024)
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
