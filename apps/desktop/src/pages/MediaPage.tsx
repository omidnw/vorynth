import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import {
	fetchLocalMediaSummary,
	purgeLocalMedia,
	releaseArticleMedia,
} from "@/features/reader/reader-api";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { GhostCard } from "@/components/ui/GhostCard";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DocsHelpButton } from "@/features/docs/DocsHelpButton.js";
import { useTranslation } from "react-i18next";

/**
 * Media storage dashboard (v1.1.0).
 *
 * The decision surface the user asked for: every article with locally-kept
 * media is listed with its size, source, and date, plus the controls to
 * release the local copy or purge everything. Media is never stored without
 * explicit opt-in (per-item on the article reader), so this page only ever
 * shows what the user consciously chose to keep.
 */
export function MediaPage() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);

	const { data: summary, isLoading } = useQuery({
		queryKey: ["media-local"],
		queryFn: fetchLocalMediaSummary,
	});

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

	return (
		<section className="mx-auto w-full max-w-max-content-width px-gutter py-12">
			<header className="mb-10">
				{/* Back sits on its own line at the top — goes back where you came
				    from (browser history), not to a hardcoded page. */}
				<button
					type="button"
					onClick={() => navigate(-1)}
					className="mb-4 inline-flex items-center gap-2 font-label text-label-md uppercase text-on-surface-variant transition-colors hover:text-primary"
				>
					<Icon name="arrow_back" className="text-[18px]" />
					{t("media.back")}
				</button>
				{/* Title row — the help button sits directly opposite the title. */}
				<div className="flex flex-wrap items-center justify-between gap-4">
					<h1 className="flex items-center gap-3 font-headline text-display-md text-primary dark:text-primary-fixed">
						<Icon name="photo_library" className="text-[32px]" />
						{t("media.title")}
					</h1>
					<DocsHelpButton sectionId="media" />
				</div>
				<p className="mt-2 max-w-prose font-body text-body-md text-on-surface-variant">
					{t("media.subtitle")}
				</p>
			</header>

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
					<div className="space-y-3">
						{summary.articles.map((a) => (
							<GhostCard
								key={a.articleId}
								className="flex flex-wrap items-center gap-4"
							>
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
							</GhostCard>
						))}
					</div>
				</>
			)}
		</section>
	);
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
