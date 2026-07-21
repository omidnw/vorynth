import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useNavigate } from "react-router-dom";
import type { ArticleMedia } from "@vorynth/types";
import {
	fetchArticleDetail,
	fetchArticleMedia,
	setMediaKeep,
	releaseArticleMedia,
} from "@/features/reader/reader-api";
import { SupportAuthorModal } from "@/features/reader/SupportAuthorModal";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { DomainTag } from "@/components/ui/Badge";
import { GhostCard } from "@/components/ui/GhostCard";
import { useTranslation } from "react-i18next";

/**
 * Native article reader (v1.1.0).
 *
 * Focused reading view for a single collected article — title, source, author,
 * the stored plain-text body, and a media gallery pulled on-demand from the
 * original source (nothing cached unless the user opts to keep it locally).
 *
 * On first open a "support the author" modal nudges the reader toward the
 * original site; dismissable forever from the modal or from Profile.
 */
export function ArticleDetailPage() {
	const { id = "" } = useParams();
	const navigate = useNavigate();
	const { t } = useTranslation();
	const queryClient = useQueryClient();

	const [reminderDismissed, setReminderDismissed] = useState(false);
	const [read, setRead] = useState(false);
	const [saved, setSaved] = useState(false);
	const [zoomed, setZoomed] = useState<ArticleMedia | null>(null);

	const { data: detail, isLoading } = useQuery({
		queryKey: ["article", id],
		queryFn: () => fetchArticleDetail(id),
		enabled: Boolean(id),
	});
	const { data: media = [] } = useQuery({
		queryKey: ["article-media", id],
		queryFn: () => fetchArticleMedia(id),
		enabled: Boolean(id),
	});

	const keepMutation = useMutation({
		mutationFn: ({ url, keep }: { url: string; keep: boolean }) =>
			setMediaKeep(id, { url, keep }),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: ["article-media", id] }),
	});
	const releaseAllMutation = useMutation({
		mutationFn: () => releaseArticleMedia(id),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: ["article-media", id] }),
	});

	if (isLoading) {
		return (
			<section className="mx-auto w-full max-w-max-content-width px-gutter py-16">
				<p className="font-body text-body-md text-on-surface-variant">
					{t("article.loading")}
				</p>
			</section>
		);
	}

	if (!detail) {
		return (
			<section className="mx-auto w-full max-w-max-content-width px-gutter py-16">
				<GhostCard className="flex flex-col items-center gap-4 text-center">
					<Icon
						name="error_outline"
						className="text-[40px] text-on-tertiary-container"
					/>
					<h2 className="font-headline text-headline-md text-primary">
						{t("article.notFound")}
					</h2>
					<Button variant="secondary" icon="arrow_back">
						<Link to="/brief">{t("article.backToBrief")}</Link>
					</Button>
				</GhostCard>
			</section>
		);
	}

	const { article, sourceName, sourceCategory } = detail;
	const showReminder = !reminderDismissed;
	const keptCount = media.filter((m) => m.source === "local").length;

	return (
		<article className="mx-auto w-full max-w-max-content-width px-gutter pb-32 pt-8">
			{showReminder ? (
				<SupportAuthorModal
					articleUrl={article.url}
					articleTitle={article.title}
					onReadHere={() => setReminderDismissed(true)}
				/>
			) : null}

			<header className="mb-12">
				<Link
					to="/brief"
					className="mb-6 inline-flex items-center gap-2 font-label text-label-md uppercase text-on-surface-variant hover:text-primary"
				>
					<Icon name="arrow_back" className="text-[18px]" />
					{t("article.back")}
				</Link>
				<div className="mb-6 flex flex-wrap items-center gap-3">
					{sourceCategory ? <DomainTag>{sourceCategory}</DomainTag> : null}
					<span className="font-label text-label-sm uppercase tracking-widest text-on-tertiary-container">
						{sourceName ?? t("article.unknownSource")}
					</span>
					{article.author ? (
						<span className="font-label text-label-sm text-on-surface-variant">
							· {t("article.by")} {article.author}
						</span>
					) : null}
					{article.publishedAt ? (
						<span className="ml-auto font-mono text-mono-technical text-on-tertiary-container">
							{new Date(article.publishedAt).toLocaleDateString(undefined, {
								day: "numeric",
								month: "long",
								year: "numeric",
							})}
						</span>
					) : null}
				</div>
				<h1
					className="mb-6 font-headline text-display-lg leading-tight text-primary dark:text-primary-fixed"
					dir="auto"
				>
					{article.title}
				</h1>
				<div className="mb-4 h-0.5 w-12 bg-primary" />
				<a
					href={article.url}
					target="_blank"
					rel="noreferrer"
					className="inline-flex items-center gap-2 font-label text-label-md text-secondary hover:underline"
				>
					<Icon name="open_in_new" className="text-[16px]" />
					{t("article.readOriginal")}
				</a>
			</header>

			{/* Body — stored plain text in a focused reading column. */}
			<GhostCard className="mb-12">
				<div
					className="mx-auto max-w-prose whitespace-pre-wrap font-body text-body-lg leading-relaxed text-on-surface"
					dir="auto"
				>
					{article.content || t("article.noContent")}
				</div>
			</GhostCard>

			{/* Media gallery — on-demand from source, per-item keep toggle. */}
			{media.length > 0 ? (
				<section className="mb-12">
					<div className="mb-6 flex flex-wrap items-center justify-between gap-3">
						<h2 className="flex items-center gap-2 font-headline text-headline-md text-primary dark:text-primary-fixed">
							<Icon name="photo_library" className="text-[24px]" />
							{t("article.media")}
							<span className="font-mono text-mono-technical text-on-tertiary-container">
								{media.length}
							</span>
						</h2>
						<div className="flex items-center gap-2">
							{keptCount > 0 ? (
								<Button
									variant="ghost"
									size="sm"
									icon="delete_sweep"
									onClick={() => releaseAllMutation.mutate()}
								>
									{t("article.releaseAll")}
								</Button>
							) : null}
							<a
								href={article.url}
								target="_blank"
								rel="noreferrer"
								className="font-label text-label-sm text-on-surface-variant hover:text-primary"
							>
								{t("article.mediaFromSource")}
							</a>
						</div>
					</div>
					<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
						{media.map((m) => (
							<MediaItem
								key={m.id}
								media={m}
								onToggleKeep={(keep) =>
									keepMutation.mutate({ url: m.url, keep })
								}
								onZoom={() => setZoomed(m)}
								toggling={keepMutation.isPending}
							/>
						))}
					</div>
				</section>
			) : null}

			{/* Floating action footer (mirrors InsightDetailPage). */}
			<footer className="fixed bottom-12 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-outline-variant bg-surface-container px-6 py-3 shadow-2xl">
				<ActionBtn
					icon={read ? "check" : "check_circle"}
					label={read ? t("article.read") : t("article.markRead")}
					onClick={() => setRead(true)}
				/>
				<div className="mx-2 h-6 w-px bg-outline-variant" />
				<ActionBtn
					icon={saved ? "bookmark_added" : "bookmark"}
					label={saved ? t("article.saved") : t("article.save")}
					onClick={() => setSaved((v) => !v)}
				/>
				<ActionBtn
					icon="ios_share"
					label={t("article.share")}
					onClick={() => {
						if (navigator.share) {
							void navigator.share({
								title: article.title,
								url: article.url,
							});
						} else {
							void navigator.clipboard.writeText(article.url);
						}
					}}
				/>
				<div className="mx-2 h-6 w-px bg-outline-variant" />
				<ActionBtn
					icon="open_in_new"
					label={t("article.original")}
					onClick={() =>
						window.open(article.url, "_blank", "noopener,noreferrer")
					}
				/>
				<ActionBtn
					icon="arrow_back"
					label={t("article.back")}
					onClick={() => navigate("/brief")}
				/>
			</footer>

			{/* Zoom overlay. */}
			{zoomed ? (
				<div
					className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-6"
					onClick={(e) => {
						if (e.target === e.currentTarget) setZoomed(null);
					}}
				>
					<button
						className="absolute right-6 top-6 text-on-surface-variant hover:text-primary"
						onClick={() => setZoomed(null)}
						aria-label={t("article.close")}
					>
						<Icon name="close" className="text-[28px]" />
					</button>
					{zoomed.kind === "image" ? (
						<img
							src={zoomed.url}
							alt={zoomed.caption ?? article.title}
							className="max-h-[85vh] max-w-[90vw] rounded object-contain"
						/>
					) : (
						<video
							src={zoomed.url}
							controls
							className="max-h-[85vh] max-w-[90vw] rounded"
						/>
					)}
				</div>
			) : null}
		</article>
	);
}

function MediaItem({
	media,
	onToggleKeep,
	onZoom,
	toggling,
}: {
	media: ArticleMedia;
	onToggleKeep: (keep: boolean) => void;
	onZoom: () => void;
	toggling: boolean;
}) {
	const { t } = useTranslation();
	const kept = media.source === "local";
	return (
		<figure className="group overflow-hidden rounded border border-outline-variant bg-surface-container-low">
			<button
				type="button"
				onClick={onZoom}
				className="block w-full cursor-zoom-in bg-black/5"
				aria-label={t("article.zoom")}
			>
				{media.kind === "image" ? (
					<img
						src={media.url}
						alt={media.caption ?? ""}
						loading="lazy"
						className="h-48 w-full object-cover transition-transform group-hover:scale-[1.02]"
					/>
				) : (
					<video
						src={media.url}
						controls
						preload="metadata"
						className="h-48 w-full bg-black object-contain"
					/>
				)}
			</button>
			<figcaption className="flex items-center justify-between gap-2 p-3">
				<div className="min-w-0">
					{media.caption ? (
						<p className="truncate font-body text-body-sm text-on-surface-variant">
							{media.caption}
						</p>
					) : null}
					<p className="font-mono text-[11px] text-on-tertiary-container">
						{kept
							? `${t("article.keptLocal")}${media.bytes ? ` · ${formatBytes(media.bytes)}` : ""}`
							: t("article.fromSource")}
					</p>
				</div>
				<button
					type="button"
					onClick={() => onToggleKeep(!kept)}
					disabled={toggling}
					className={`flex h-8 w-8 items-center justify-center rounded transition-colors ${
						kept
							? "bg-secondary-container text-on-secondary-container"
							: "text-on-surface-variant hover:bg-surface-container-high"
					}`}
					aria-label={kept ? t("article.releaseLocal") : t("article.keepLocal")}
					title={kept ? t("article.releaseLocal") : t("article.keepLocal")}
				>
					<Icon
						name={kept ? "download_done" : "download_for_offline"}
						className="text-[18px]"
					/>
				</button>
			</figcaption>
		</figure>
	);
}

function ActionBtn({
	icon,
	label,
	onClick,
}: {
	icon: string;
	label: string;
	onClick?: () => void;
}) {
	return (
		<button
			onClick={onClick}
			className="flex items-center gap-2 rounded-full px-4 py-2 transition-colors hover:bg-surface-container-high"
		>
			<Icon name={icon} className="text-[20px]" />
			<span className="font-label text-label-md uppercase tracking-wide">
				{label}
			</span>
		</button>
	);
}

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
