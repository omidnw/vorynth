import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { locationHasHistory } from "@/lib/router/has-history.js";
import type { TFunction } from "i18next";
import type { GeneratedHistoryKind } from "@vorynth/types";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { GhostCard } from "@/components/ui/GhostCard";
import { ExportDialog } from "@/components/export/ExportDialog";
import { usePluginStoryExports } from "@/plugins/plugin-hooks";
import { DocsHelpButton } from "@/features/docs/DocsHelpButton.js";
import { fetchGeneratedEntry } from "@/features/history/history-api.js";
import { useHistoryStore } from "@/features/history/history-store.js";
import { useTextDirection, useTranslation } from "@/i18n";

/**
 * Full-page view for a saved generated history entry (Profile LLM generations).
 *
 * Renders the cached generated text (behavior summary or improved instruction)
 * in a focused, beautiful layout.
 */
export function HistoryGeneratedDetailPage() {
	const { id = "" } = useParams();
	const { t } = useTranslation();
	const navigate = useNavigate();
	const location = useLocation();
	const closeDrawer = useHistoryStore((s) => s.closeDrawer);
	const textDir = useTextDirection();
	const [showExport, setShowExport] = useState(false);
	const storyExports = usePluginStoryExports();

	// Smart back: return to whatever opened this page (Archive, the drawer…)
	// when there's history; otherwise fall back to Profile.
	const goBack = () => {
		closeDrawer();
		if (locationHasHistory(location.key)) navigate(-1);
		else navigate("/profile");
	};

	const { data: entry, isLoading } = useQuery({
		queryKey: ["history", "generated", "single", id],
		queryFn: () => fetchGeneratedEntry(id),
		enabled: Boolean(id),
	});

	if (isLoading) {
		return (
			<section className="mx-auto w-full max-w-max-content-width px-gutter py-16">
				<div className="flex items-center justify-center gap-2 text-on-surface-variant">
					<Icon name="sync" className="animate-spin-reverse text-[18px]" />
					<span className="font-mono text-[11px] uppercase tracking-widest">
						{t("article.loading")}
					</span>
				</div>
			</section>
		);
	}

	if (!entry) {
		return (
			<section className="mx-auto w-full max-w-max-content-width px-gutter py-16">
				<GhostCard className="flex flex-col items-center gap-4 text-center">
					<Icon
						name="error_outline"
						className="text-[40px] text-on-tertiary-container"
					/>
					<h2 className="font-headline text-headline-md text-primary">
						{t("historyGenerated.notFound")}
					</h2>
					<p className="font-body text-body-md text-on-surface-variant">
						{t("historyGenerated.notFoundBody")}
					</p>
					<Button
						variant="secondary"
						icon="arrow_back"
						onClick={() => navigate("/profile")}
					>
						{t("historyGenerated.backToProfile")}
					</Button>
				</GhostCard>
			</section>
		);
	}

	const isSummary = entry.kind === "behavior-summary";

	return (
		<article className="mx-auto w-full max-w-max-content-width px-gutter pb-32 pt-8">
			{/* Header */}
			<header className="mb-12">
				<div className="mb-6 flex flex-wrap items-center justify-between gap-4">
					<button
						type="button"
						onClick={goBack}
						className="inline-flex cursor-pointer items-center gap-2 font-label text-label-md uppercase text-on-surface-variant transition-colors hover:text-primary"
					>
						<Icon name="arrow_back" className="text-[18px]" />
						{t("historyGenerated.backToProfile")}
					</button>
					<DocsHelpButton sectionId="history" />
				</div>

				<div className="mb-4 flex flex-wrap items-center gap-3">
					<KindBadge kind={entry.kind} />
					<span className="font-mono text-[11px] text-on-tertiary-container">
						{timeAgo(entry.createdAt, t)}
					</span>
					{entry.tokensUsed > 0 ? (
						<>
							<span className="h-1 w-1 rounded-full bg-outline-variant" />
							<span className="font-mono text-[11px] text-on-tertiary-container">
								{t("historyGenerated.tokens", {
									count: entry.tokensUsed.toLocaleString(),
								})}
							</span>
						</>
					) : null}
					{entry.archived ? (
						<>
							<span className="h-1 w-1 rounded-full bg-outline-variant" />
							<span className="font-mono text-[11px] text-on-tertiary-container">
								{t("historyGenerated.archived")}
							</span>
						</>
					) : null}
				</div>

				<h1
					className="font-headline text-display-lg leading-tight text-primary dark:text-primary-fixed"
					dir={textDir(entry.title)}
				>
					{entry.title}
				</h1>

				<p className="mt-4 font-label text-label-sm uppercase tracking-widest text-on-surface-variant">
					{isSummary
						? t("historyGenerated.behaviorSummary")
						: t("historyGenerated.improvedCustomInstruction")}
				</p>
			</header>

			{/* Divider */}
			<div className="mb-10 h-px bg-outline-variant" />

			{/* Generated text */}
			<GhostCard className="border-s-2 border-s-primary">
				<h3 className="mb-4 flex items-center gap-2 font-label text-label-md uppercase tracking-widest text-primary">
					<Icon
						name={isSummary ? "insights" : "tune"}
						className="text-[16px]"
					/>
					{isSummary
						? t("historyGenerated.behaviorSummary")
						: t("historyGenerated.improvedInstruction")}
				</h3>
				<div
					className="whitespace-pre-wrap font-body text-body-lg leading-relaxed text-on-surface"
					dir={textDir(entry.result)}
				>
					{entry.result}
				</div>
				{entry.tokensUsed > 0 ? (
					<div className="mt-6 flex items-center gap-2 border-t border-outline-variant pt-4 font-mono text-[12px] text-on-tertiary-container">
						<Icon name="token" className="text-[14px]" />
						{t("historyGenerated.tokensUsed", {
							count: entry.tokensUsed.toLocaleString(),
						})}
					</div>
				) : null}
			</GhostCard>

			{/* Floating action footer */}
			<footer className="fixed bottom-12 start-1/2 z-50 flex -translate-x-1/2 rtl:translate-x-1/2 items-center gap-2 rounded-full border border-outline-variant bg-surface-container px-6 py-3 shadow-2xl">
				<ActionBtn
					icon="refresh"
					label={
						isSummary
							? t("historyGenerated.regenerate")
							: t("historyGenerated.improveAgain")
					}
					onClick={() => {
						closeDrawer();
						navigate("/profile");
					}}
				/>
				<div className="mx-2 h-6 w-px bg-outline-variant" />
				<ActionBtn
					icon="content_copy"
					label={t("historyGenerated.copyText")}
					onClick={() => {
						void navigator.clipboard
							.writeText(entry.result)
							.catch(() => undefined);
					}}
				/>
				{storyExports.length > 0 ? (
					<>
						<div className="mx-2 h-6 w-px bg-outline-variant" />
						<ActionBtn
							icon="file_download"
							label={t("article.export")}
							onClick={() => setShowExport(true)}
						/>
					</>
				) : null}
				<div className="mx-2 h-6 w-px bg-outline-variant" />
				<ActionBtn
					icon="arrow_back"
					label={t("common.back")}
					onClick={goBack}
				/>
			</footer>

			{/* Export — the generated text as a self-contained document (v1.8.0). */}
			{showExport ? (
				<ExportDialog
					content={{
						kind: "other",
						title: entry.title,
						body: entry.result,
					}}
					onClose={() => setShowExport(false)}
				/>
			) : null}
		</article>
	);
}

// ── Shared bits ──────────────────────────────────────────────────────────────

function KindBadge({ kind }: { kind: GeneratedHistoryKind }) {
	const { t } = useTranslation();
	const isSummary = kind === "behavior-summary";
	return (
		<span className="inline-flex items-center gap-1.5 rounded bg-primary-container px-2.5 py-1 font-label text-[11px] uppercase tracking-widest text-on-primary-container">
			<Icon name={isSummary ? "insights" : "tune"} className="text-[14px]" />
			{isSummary
				? t("historyGenerated.behaviorSummary")
				: t("historyGenerated.instruction")}
		</span>
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

function timeAgo(iso: string, t: TFunction): string {
	const then = new Date(iso).getTime();
	if (Number.isNaN(then)) return "—";
	const diff = Date.now() - then;
	const sec = Math.round(diff / 1000);
	if (sec < 60) return t("historyGenerated.justNow");
	const min = Math.round(sec / 60);
	if (min < 60) return t("historyGenerated.minAgo", { count: min });
	const hr = Math.round(min / 60);
	if (hr < 24) return t("historyGenerated.hoursAgo", { count: hr });
	const day = Math.round(hr / 24);
	if (day < 30) return t("historyGenerated.daysAgo", { count: day });
	const mo = Math.round(day / 30);
	if (mo < 12) return t("historyGenerated.monthsAgo", { count: mo });
	return t("historyGenerated.yearsAgo", { count: Math.round(mo / 12) });
}
