import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { locationHasHistory } from "@/lib/router/has-history.js";
import type { ArticleMedia } from "@vorynth/types";
import { recordStoryView } from "@/features/story-views/story-views-api.js";
import {
	fetchArticleDetail,
	fetchArticleMedia,
	setMediaKeep,
	releaseArticleMedia,
	recollectArticle,
	translateArticle,
} from "@/features/reader/reader-api";
import { SupportAuthorModal } from "@/features/reader/SupportAuthorModal";
import { ReaderActionBar } from "@/features/reader/ReaderActionBar";
import { usePluginStoryExports } from "@/plugins/plugin-hooks";
import { fetchSettings } from "@/features/history/history-api.js";
import { Icon } from "@/components/ui/Icon";
import { RichContent } from "@/components/ui/RichContent";
import { ExportDialog } from "@/components/export/ExportDialog";
import { Button } from "@/components/ui/Button";
import { DomainTag } from "@/components/ui/Badge";
import { GhostCard } from "@/components/ui/GhostCard";
import { useBookmarkToggle } from "@/features/archive/use-bookmark.js";
import { fetchProfile } from "@/features/profile/profile-api.js";
import { DocsHelpButton } from "@/features/docs/DocsHelpButton.js";
import { useTranslation, useTextDirection } from "@/i18n";
import { aiErrorMessage } from "@/features/llm/ai-error.js";

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
	const location = useLocation();
	const { t } = useTranslation();
	const textDir = useTextDirection();
	const queryClient = useQueryClient();

	// Smart back: return to the page that opened this article (Brief, Archive,
	// Bookmarks, Search) when there's history to go back to; otherwise fall back
	// to the Brief. `locationHasHistory` means react-router has a prior entry in
	// its history stack (reliable across trailing-slash deep links on reload).
	const goBack = () => {
		if (locationHasHistory(location.key)) navigate(-1);
		else navigate("/brief");
	};

	// v1.8.0 — story-view history: opening the article records scope='article'
	// so the Brief History tab can show which story was read, when, and on
	// which surface. Best-effort; a failed record never breaks the read.
	useEffect(() => {
		if (!id) return;
		void recordStoryView({ articleId: id, scope: "article" }).catch(
			() => undefined,
		);
	}, [id]);

	const [reminderDismissed, setReminderDismissed] = useState(false);
	const [read, setRead] = useState(false);
	// Original/Translated toggles — one for the title, one for the body. Both
	// default to the translated version when one exists (R-A07: the original is
	// always one toggle away, never lost).
	const [showOriginal, setShowOriginal] = useState(false);
	const [showOriginalBody, setShowOriginalBody] = useState(false);
	const [zoomed, setZoomed] = useState<ArticleMedia | null>(null);
	const [showExport, setShowExport] = useState(false);

	const { data: detail, isLoading } = useQuery({
		queryKey: ["article", id],
		queryFn: () => fetchArticleDetail(id),
		enabled: Boolean(id),
	});
	const { data: profile } = useQuery({
		queryKey: ["profile"],
		queryFn: fetchProfile,
	});
	const { data: media = [] } = useQuery({
		queryKey: ["article-media", id],
		queryFn: () => fetchArticleMedia(id),
		enabled: Boolean(id),
	});
	// Which reader-footer actions stay pinned in the bar (Profile preference).
	const { data: settings } = useQuery({
		queryKey: ["app-settings"],
		queryFn: fetchSettings,
	});
	const readerPinned = settings?.["ui.readerPinnedActions"];

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

	// Per-story translate (v1.8.0) — shown next to the title until a translation
	// exists. On success the article query refreshes (title + body become the
	// translation) and the Brief feed picks up the new title.
	const translateMutation = useMutation({
		mutationFn: () => translateArticle(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["article", id] });
			queryClient.invalidateQueries({ queryKey: ["reports"] });
		},
	});

	// Per-story Re-collect (v1.8.0) — the full repair pipeline for one story:
	// re-fetch the origin, refresh the full text, re-translate, fill a missing
	// insight. Shown in the floating footer next to Save.
	const recollectMutation = useMutation({
		mutationFn: () => recollectArticle(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["article", id] });
			queryClient.invalidateQueries({ queryKey: ["reports"] });
		},
	});

	// Per-story Re-translate (v1.8.0) — shown when the engine detects the stored
	// translation is incomplete; forces a fresh translation of title + body.
	const retranslateMutation = useMutation({
		mutationFn: () => translateArticle(id, { force: true }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["article", id] });
			queryClient.invalidateQueries({ queryKey: ["reports"] });
		},
	});

	// Story export panels contributed by enabled UI plugins (Story Renderer).
	const storyExports = usePluginStoryExports();

	// Real save — bookmark flag on the article's content item (v1.6.0).
	const bookmark = useBookmarkToggle(detail?.article.contentItemId);

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
					<Button variant="secondary" icon="arrow_back" onClick={goBack}>
						{t("article.backToBrief")}
					</Button>
				</GhostCard>
			</section>
		);
	}

	const { article, sourceName, sourceCategory } = detail;
	const hasOriginalTitle = Boolean(article.originalTitle);
	const hasTranslatedBody = Boolean(article.translatedContent);
	// Per-story translate shows while the story isn't fully translated —
	// "fully translated" = the title is translated AND there's no body left to
	// translate (body empty or body translated). A legacy title-only
	// translation and a story with a title but no body text both keep the pill.
	const bodyEmpty = !article.content.trim();
	const fullyTranslated = hasOriginalTitle && (bodyEmpty || hasTranslatedBody);
	// Re-translate (v1.8.0): every story that HAS a translation — complete or
	// incomplete — offers Re-translate, so the user can force a fresh AI pass
	// any time (after a language change, or when a translation looks off).
	// Only a never-translated story shows the plain Translate pill instead.
	const canRetranslate = hasTranslatedBody;
	// Same-language guard (v1.8.0): a story whose SOURCE language already equals
	// the user's intelligence language is never translated (the engine skips it
	// too) — hide the pill instead of offering a no-op translation.
	const targetLang = profile?.preferredIntelligenceLanguage?.toLowerCase();
	const sourceLang = article.language?.toLowerCase();
	const sameLanguage = Boolean(
		sourceLang && targetLang && sourceLang === targetLang,
	);
	const displayTitle =
		showOriginal && hasOriginalTitle
			? (article.originalTitle ?? article.title)
			: article.title;
	// Controls trail the title — translate pill, then the Original toggle —
	// matching the Brief card. The h1 itself carries the text direction; the
	// row stays in layout order so the pill reads "in front of" the title.
	const titleDir = textDir(displayTitle);
	// Default shows the translation when present; the toggle reveals the
	// original `content` (which stays canonical in storage, R-A05). A damaged
	// body (captured page-interface junk) shows its read-time cleanup instead
	// of the raw JSON/chrome (v1.8.0). A same-language story shows the original
	// even if a stale translation from a previous language setting is stored.
	const showTranslation = hasTranslatedBody && !sameLanguage;
	const displayContent =
		showTranslation && !showOriginalBody
			? (article.translatedContent ?? article.content)
			: (article.contentClean ?? article.content);
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
				<div className="mb-6 flex flex-wrap items-center justify-between gap-4">
					<button
						type="button"
						onClick={goBack}
						className="inline-flex items-center gap-2 font-label text-label-md uppercase text-on-surface-variant hover:text-primary"
					>
						<Icon name="arrow_back" className="text-[18px]" />
						{t("article.back")}
					</button>
					<DocsHelpButton sectionId="media" />
				</div>
				<div className="mb-6 flex flex-wrap items-center gap-3">
					{sourceCategory ? <DomainTag>{sourceCategory}</DomainTag> : null}
					<span
						className="font-label text-label-sm uppercase tracking-widest text-on-tertiary-container"
						dir={textDir(sourceName ?? "")}
					>
						{sourceName ?? t("article.unknownSource")}
					</span>
					{article.author ? (
						<span
							className="font-label text-label-sm text-on-surface-variant"
							dir={textDir(article.author)}
						>
							· {t("article.by")} {article.author}
						</span>
					) : null}
					{article.publishedAt ? (
						<span className="ms-auto font-mono text-mono-technical text-on-tertiary-container">
							{new Date(article.publishedAt).toLocaleDateString(undefined, {
								day: "numeric",
								month: "long",
								year: "numeric",
							})}
						</span>
					) : null}
				</div>
				{/* The row mirrors the title's direction: LTR keeps the controls
				    after the title (right); an RTL title leads from the right and
				    the controls trail it on the left. */}
				<div className="mb-6 flex items-start gap-3" dir={titleDir}>
					<h1
						className="font-headline text-display-lg leading-tight text-primary dark:text-primary-fixed"
						dir={titleDir}
					>
						{displayTitle}
					</h1>
					{!fullyTranslated && !sameLanguage ? (
						<button
							type="button"
							onClick={() => translateMutation.mutate()}
							disabled={translateMutation.isPending}
							className="mt-2 inline-flex shrink-0 items-center gap-1.5 rounded border border-outline-variant px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-on-tertiary-container transition-colors hover:border-secondary hover:text-secondary disabled:opacity-60"
							title={t("article.translateHint")}
						>
							<Icon name="translate" className="text-[14px]" />
							{translateMutation.isPending
								? t("article.translating")
								: t("article.translate")}
						</button>
					) : canRetranslate && !sameLanguage ? (
						<button
							type="button"
							onClick={() => retranslateMutation.mutate()}
							disabled={retranslateMutation.isPending}
							className="mt-2 inline-flex shrink-0 items-center gap-1.5 rounded border border-outline-variant px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-on-tertiary-container transition-colors hover:border-secondary hover:text-secondary disabled:opacity-60"
							title={t("article.retranslateHint")}
						>
							<Icon name="translate" className="text-[14px]" />
							{retranslateMutation.isPending
								? t("article.retranslating")
								: t("article.retranslate")}
						</button>
					) : null}
					{hasOriginalTitle ? (
						<button
							type="button"
							onClick={(e) => {
								e.stopPropagation();
								setShowOriginal((v) => !v);
							}}
							className="mt-2 shrink-0 rounded border border-outline-variant px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-on-tertiary-container transition-colors hover:border-secondary hover:text-secondary"
							title={
								showOriginal
									? t("article.showTranslatedTitle")
									: t("article.showOriginalTitle")
							}
						>
							{showOriginal ? t("article.translated") : t("article.original")}
						</button>
					) : null}
				</div>
				{translateMutation.isError ? (
					<p className="mb-4 font-body text-body-sm text-error">
						{aiErrorMessage(
							t,
							translateMutation.error,
							"article.translateFailed",
						)}
					</p>
				) : null}
				{article.contentCorrupted ? (
					<p
						className="mb-4 inline-flex items-start gap-1.5 font-body text-body-sm text-on-surface-variant"
						dir={titleDir}
					>
						<Icon name="info" className="mt-0.5 shrink-0 text-[14px]" />
						<span>{t("article.contentCorruptedNote")}</span>
					</p>
				) : null}
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

			{/* Body — stored plain text in a focused reading column. An
			    Original/Translated toggle sits above it when a translation exists. */}
			<GhostCard className="mb-12">
				{hasTranslatedBody ? (
					<div className="mb-4 flex justify-end">
						<button
							type="button"
							onClick={() => setShowOriginalBody((v) => !v)}
							className="rounded border border-outline-variant px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-on-tertiary-container transition-colors hover:border-secondary hover:text-secondary"
							title={
								showOriginalBody
									? t("article.showTranslatedBody")
									: t("article.showOriginalBody")
							}
						>
							{showOriginalBody
								? t("article.translated")
								: t("article.original")}
						</button>
					</div>
				) : null}
				{/* Body — stored text in a focused reading column. Feed bodies that
				    carry HTML (bold, links, lists) render sanitized (RichContent);
				    plain-text bodies render as before. */}
				<RichContent
					text={displayContent || t("article.noContent")}
					dir={textDir(displayContent)}
					className="mx-auto max-w-prose font-body text-body-lg leading-relaxed text-on-surface"
				/>
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

			{/* Floating action bar — pinned actions up front, the rest behind the
			    More ⋮ menu (Profile → Reader actions chooses which are pinned). */}
			<ReaderActionBar
				pinnedIds={readerPinned}
				moreLabel={t("article.more")}
				moreAriaLabel={t("article.moreAria")}
				actions={[
					{
						id: "markRead",
						icon: read ? "check" : "check_circle",
						label: read ? t("article.read") : t("article.markRead"),
						onClick: () => setRead(true),
					},
					{
						id: "save",
						icon: bookmark.saved ? "bookmark_added" : "bookmark",
						label: bookmark.saved ? t("article.saved") : t("article.save"),
						onClick: bookmark.toggle,
					},
					{
						id: "recollect",
						icon: "refresh",
						label: recollectMutation.isPending
							? t("article.recollecting")
							: t("article.recollect"),
						busy: recollectMutation.isPending,
						onClick: () => {
							if (!recollectMutation.isPending) recollectMutation.mutate();
						},
					},
					// Re-translate sits right next to Re-collect (v1.8.0): forces a
					// fresh LLM translation of title + body with no re-fetch. Only
					// when the story was translated at least once — a never-translated
					// story uses the Translate pill next to the title instead.
					...(hasOriginalTitle || hasTranslatedBody
						? [
								{
									id: "retranslate" as const,
									icon: "translate",
									label: retranslateMutation.isPending
										? t("article.retranslating")
										: t("article.retranslate"),
									busy: retranslateMutation.isPending,
									onClick: () => {
										if (!retranslateMutation.isPending)
											retranslateMutation.mutate();
									},
								},
							]
						: []),
					{
						id: "share",
						icon: "ios_share",
						label: t("article.share"),
						onClick: () => {
							if (navigator.share) {
								void navigator.share({
									title: article.title,
									url: article.url,
								});
							} else {
								void navigator.clipboard.writeText(article.url);
							}
						},
					},
					...(storyExports.length > 0
						? [
								{
									id: "export" as const,
									icon: "file_download",
									label: t("article.export"),
									onClick: () => setShowExport(true),
								},
							]
						: []),
					{
						id: "openOriginal",
						icon: "open_in_new",
						label: t("article.original"),
						onClick: () =>
							window.open(article.url, "_blank", "noopener,noreferrer"),
					},
					{
						id: "back",
						icon: "arrow_back",
						label: t("article.back"),
						onClick: goBack,
					},
				]}
			/>

			{/* Export dialog — driven by UI plugins' exporter contribution, fed a
			    generic content payload (v1.8.0). */}
			{showExport ? (
				<ExportDialog
					content={{
						kind: "article",
						title: article.title,
						body: article.content,
						translatedBody: article.translatedContent ?? undefined,
						url: article.url,
						source: sourceName ?? undefined,
						author: article.author ?? undefined,
						publishedAt: article.publishedAt,
					}}
					onClose={() => setShowExport(false)}
				/>
			) : null}

			{/* Zoom overlay. */}
			{zoomed ? (
				<div
					className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-6"
					onClick={(e) => {
						if (e.target === e.currentTarget) setZoomed(null);
					}}
				>
					<button
						className="absolute end-6 top-6 text-on-surface-variant hover:text-primary"
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
	const textDir = useTextDirection();
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
						<p
							className="truncate font-body text-body-sm text-on-surface-variant"
							dir={textDir(media.caption)}
						>
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

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
