import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useNavigate } from "react-router-dom";
import type { Insight } from "@vorynth/types";
import { apiFetch } from "@/lib/api/config";
import { fetchArticleDetail } from "@/features/reader/reader-api";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { ImportanceBadge, DomainTag } from "@/components/ui/Badge";
import { GhostCard } from "@/components/ui/GhostCard";

/**
 * Intelligence detail view (examples/intelligence-detail.html).
 *
 * Focused reading mode for a single AI-generated insight. Note: insights only
 * exist when an LLM provider has analyzed an article — this route is only
 * reachable from a Brief entry that carries `insight`.
 *
 * The insight DTO carries `articleId` (not the URL), so when one is present we
 * also fetch the underlying article to surface a "Read original article" link
 * to the source site. Cluster-level insights (`articleId === null`) have no
 * single source and hide the link.
 */
export function InsightDetailPage() {
	const { id = "" } = useParams();
	const navigate = useNavigate();
	const [saved, setSaved] = useState(false);
	const [read, setRead] = useState(false);
	const { data: insight, isLoading } = useQuery({
		queryKey: ["insight", id],
		queryFn: () => apiFetch<Insight | null>(`/insights/${id}`),
		enabled: Boolean(id),
	});

	// Resolve the underlying article so we can link out to the original source.
	// Only insights tied to a single article have an articleId; cluster-level
	// insights are null and skip this fetch.
	const { data: articleDetail } = useQuery({
		queryKey: ["article", insight?.articleId],
		queryFn: () => fetchArticleDetail(insight!.articleId!),
		enabled: Boolean(insight?.articleId),
	});
	const articleUrl = articleDetail?.article.url ?? null;

	if (isLoading) {
		return (
			<section className="mx-auto w-full max-w-max-content-width px-gutter py-16">
				<p className="font-body text-body-md text-on-surface-variant">
					Loading…
				</p>
			</section>
		);
	}

	if (!insight) {
		return (
			<section className="mx-auto w-full max-w-max-content-width px-gutter py-16">
				<GhostCard className="flex flex-col items-center gap-4 text-center">
					<Icon
						name="error_outline"
						className="text-[40px] text-on-tertiary-container"
					/>
					<h2 className="font-headline text-headline-md text-primary">
						Insight not found
					</h2>
					<Button variant="secondary" icon="arrow_back">
						<Link to="/brief">Back to Brief</Link>
					</Button>
				</GhostCard>
			</section>
		);
	}

	return (
		<article className="mx-auto w-full max-w-max-content-width px-gutter pb-32 pt-8">
			<header className="mb-12">
				<Link
					to="/brief"
					className="mb-6 inline-flex items-center gap-2 font-label text-label-md uppercase text-on-surface-variant hover:text-primary"
				>
					<Icon name="arrow_back" className="text-[18px]" />
					Back
				</Link>
				<div className="mb-6 flex flex-wrap items-center gap-3">
					<ImportanceBadge tier={insight.importanceTier}>
						{tierLabel(insight.importanceTier)}
					</ImportanceBadge>
					<DomainTag>{insight.category}</DomainTag>
					<span className="ml-auto font-mono text-mono-technical text-on-tertiary-container">
						Score {insight.importanceScore.toFixed(1)} ·{" "}
						{insight.generatedLanguage.toUpperCase()}
					</span>
				</div>
				<h1
					className="mb-6 font-headline text-display-lg leading-tight text-primary dark:text-primary-fixed"
					dir="auto"
				>
					{insight.summary}
				</h1>
				<p
					className="border-l-2 border-primary-fixed pl-6 font-body text-body-lg italic leading-relaxed text-on-surface-variant"
					dir="auto"
				>
					{insight.significance}
				</p>

				{/* Link to the original source article. Only insights tied to a
				    single article have a resolvable URL; cluster-level insights
				    (articleId === null) omit this row. */}
				{articleUrl ? (
					<div className="mt-6 flex flex-wrap items-center gap-3">
						<a
							href={articleUrl}
							target="_blank"
							rel="noreferrer"
							className="inline-flex items-center gap-2 font-label text-label-md text-secondary transition-colors hover:text-primary hover:underline"
						>
							<Icon name="open_in_new" className="text-[16px]" />
							Read original article
						</a>
						{articleDetail?.sourceName ? (
							<span className="font-mono text-[11px] uppercase tracking-widest text-on-tertiary-container">
								on {articleDetail.sourceName}
							</span>
						) : null}
						<span className="font-mono text-[11px] uppercase tracking-widest text-on-tertiary-container">
							·
						</span>
						<Link
							to={`/articles/${insight.articleId}`}
							className="inline-flex items-center gap-1 font-label text-label-sm uppercase tracking-wide text-on-surface-variant transition-colors hover:text-primary hover:underline"
						>
							<Icon name="menu_book" className="text-[14px]" />
							In-app reader
						</Link>
					</div>
				) : null}
			</header>

			<div className="grid grid-cols-1 gap-12">
				<GhostCard>
					<h2 className="mb-4 font-headline text-headline-lg text-primary dark:text-primary-fixed">
						Technical Context
					</h2>
					<p
						className="font-body text-body-lg leading-relaxed text-on-surface"
						dir="auto"
					>
						{insight.impact}
					</p>
				</GhostCard>

				<section className="grid grid-cols-1 gap-6 md:grid-cols-3">
					<GhostCard className="flex flex-col items-center justify-center text-center">
						<span className="mb-2 font-label text-label-sm uppercase tracking-widest text-on-surface-variant">
							Importance Score
						</span>
						<div className="font-headline text-display-lg leading-none text-primary dark:text-primary-fixed">
							{insight.importanceScore.toFixed(1)}
						</div>
						<span className="mt-2 font-mono text-mono-technical text-on-tertiary-container">
							{insight.importanceTier.toUpperCase().replace("-", "_")}
						</span>
					</GhostCard>
					<GhostCard className="md:col-span-2">
						<h3 className="mb-4 flex items-center gap-2 font-label text-label-md uppercase tracking-widest text-primary">
							<Icon name="verified" className="text-base" />
							Provenance
						</h3>
						<div className="space-y-3">
							<Row label="Source language">Mixed</Row>
							<Row label="Output language">{insight.generatedLanguage}</Row>
							<Row label="Generated">
								{new Date(insight.createdAt).toLocaleString()}
							</Row>
						</div>
					</GhostCard>
				</section>

				<section className="rounded-lg bg-primary-container p-10 text-on-primary">
					<h2 className="mb-8 flex items-center gap-3 font-headline text-headline-md">
						<Icon name="bolt" className="text-primary-fixed" fill />
						Recommended Action
					</h2>
					<p
						className="font-body text-body-lg italic leading-relaxed"
						dir="auto"
					>
						{insight.recommendedAction}
					</p>
				</section>
			</div>

			<footer className="fixed bottom-12 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-primary/20 bg-primary-container px-6 py-3 text-on-primary shadow-2xl">
				<ActionBtn
					icon={read ? "check" : "check_circle"}
					label={read ? "Read" : "Mark Read"}
					onClick={() => setRead(true)}
				/>
				<div className="mx-2 h-6 w-px bg-white/10" />
				<ActionBtn
					icon={saved ? "bookmark_added" : "bookmark"}
					label={saved ? "Saved" : "Save"}
					onClick={() => setSaved((v) => !v)}
				/>
				<ActionBtn
					icon="ios_share"
					label="Share"
					onClick={() => {
						const shareText = articleUrl
							? `${insight.summary}\n\n${insight.significance}\n\n${articleUrl}`
							: `${insight.summary}\n\n${insight.significance}`;
						if (navigator.share) {
							void navigator.share({
								title: insight.summary,
								text: shareText,
								url: articleUrl ?? undefined,
							});
						} else {
							void navigator.clipboard.writeText(shareText);
						}
					}}
				/>
				{articleUrl ? (
					<>
						<div className="mx-2 h-6 w-px bg-white/10" />
						<ActionBtn
							icon="open_in_new"
							label="Original"
							onClick={() =>
								window.open(articleUrl, "_blank", "noopener,noreferrer")
							}
						/>
					</>
				) : null}
				<div className="mx-2 h-6 w-px bg-white/10" />
				<ActionBtn
					icon="arrow_back"
					label="Back"
					onClick={() => navigate("/brief")}
				/>
			</footer>
		</article>
	);
}

function Row({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div className="flex items-center justify-between border-b border-outline-variant pb-2">
			<span className="font-body text-body-md text-on-surface-variant">
				{label}
			</span>
			<span className="font-mono text-mono-technical text-primary">
				{children}
			</span>
		</div>
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
			className="flex items-center gap-2 rounded-full px-4 py-2 transition-colors hover:bg-white/10"
		>
			<Icon name={icon} className="text-[20px]" />
			<span className="font-label text-label-md uppercase tracking-wide">
				{label}
			</span>
		</button>
	);
}

function tierLabel(tier: Insight["importanceTier"]): string {
	return tier === "signal"
		? "Signal High"
		: tier === "trend"
			? "Trend"
			: "Low Noise";
}
