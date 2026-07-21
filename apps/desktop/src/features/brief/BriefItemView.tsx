import { useNavigate } from "react-router-dom";
import type { BriefEntry } from "@vorynth/types";
import { Icon } from "@/components/ui/Icon";
import { ImportanceBadge, DomainTag } from "@/components/ui/Badge";

/**
 * One ranked row in the Brief list — **news-first**.
 *
 * Always renders the article (title + source + age + summary snippet). When
 * `entry.insight` is present (an LLM analyzed this article), the intelligence
 * triad — Why it matters / Impact / Recommended Action — renders underneath.
 *
 * In zero-config mode (no API key), every entry renders without the triad; the
 * app is a clean multi-source news reader.
 *
 * The card surface is keyboard-clickable and navigates to the focused view
 * (`/insights/:id` when intelligence exists, otherwise the native reader
 * `/articles/:id`). A separate "Read source" link opens the ORIGINAL article
 * URL on the source site in a new tab — clicking it stops propagation so the
 * card navigation doesn't also fire.
 */
export function BriefItemView({ entry }: { entry: BriefEntry }) {
	const navigate = useNavigate();
	const { article, insight, sourceNames, category, importanceTier } = entry;
	const rankLabel = String(entry.rank).padStart(2, "0");
	const hasIntelligence = Boolean(insight);

	const headline = insight?.summary?.split("\n")[0] || article.title;
	const standfirst = insight?.significance || snippet(article.content);

	// Clicking the card surface navigates to the focused view. Inner links
	// (article source, "Read") stopPropagation so they work independently.
	const openCard = () => {
		if (hasIntelligence && insight) {
			navigate(`/insights/${insight.id}`);
		} else {
			navigate(`/articles/${article.id}`);
		}
	};

	return (
		<article
			className="group cursor-pointer"
			onClick={openCard}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					openCard();
				}
			}}
			role="link"
			tabIndex={0}
		>
			<div className="flex items-start gap-10">
				<div className="rtl-flip-rank-rail flex flex-col items-center pt-1">
					<span className="font-headline text-headline-md text-outline-variant opacity-50 transition-opacity group-hover:opacity-100">
						{rankLabel}
					</span>
					<div className="mt-4 h-full w-px bg-outline-variant transition-colors group-hover:bg-primary" />
				</div>

				<div className="flex-1 pb-16">
					<div className="mb-3 flex flex-wrap items-center gap-3">
						<ImportanceBadge tier={importanceTier}>
							{tierLabel(importanceTier)}
						</ImportanceBadge>
						<DomainTag>{category}</DomainTag>
						<span className="font-label text-label-sm uppercase tracking-widest text-on-tertiary-container">
							{sourceNames.join(" · ")}
						</span>
						{article.publishedAt ? (
							<span className="ml-auto font-mono text-mono-technical text-on-tertiary-container">
								{timeAgo(article.publishedAt)}
							</span>
						) : null}
					</div>

					<h3
						className="mb-4 font-headline text-headline-lg leading-tight text-primary dark:text-primary-fixed"
						dir="auto"
					>
						{headline}
					</h3>
					<div className="mb-6 h-0.5 w-12 bg-primary" />

					<p
						className="mb-8 font-body text-body-lg leading-relaxed text-on-surface"
						dir="auto"
					>
						{standfirst}
					</p>

					{hasIntelligence && insight ? (
						<div className="grid grid-cols-1 gap-8 font-body text-body-md md:grid-cols-2">
							<div className="space-y-4">
								<Field label="Why it matters">
									{insight.significance || "—"}
								</Field>
								<Field label="Impact">{insight.impact || "—"}</Field>
								{sourceNames.length > 0 ? (
									<Field label="Sources">{sourceNames.join(" · ")}</Field>
								) : null}
							</div>
							<div className="border-l-2 border-primary bg-surface-container-low p-6 rounded">
								<h4 className="mb-2 flex items-center gap-2 font-label text-label-md uppercase tracking-wide text-on-surface-variant">
									<Icon name="lightbulb" fill className="text-[16px]" />
									Recommended Action
								</h4>
								<p className="italic text-on-surface" dir="auto">
									{insight.recommendedAction || "—"}
								</p>
							</div>
						</div>
					) : (
						<div className="flex items-center gap-2 font-mono text-mono-technical text-on-tertiary-container">
							<Icon name="open_in_new" className="text-[16px]" />
							<span>Read on {sourceNames[0] ?? "source"}</span>
						</div>
					)}

					{/* Always-present footer: open the original article on the
					    source site in a new tab. Stops propagation so the card
					    navigation doesn't also fire. */}
					<div className="mt-6 flex items-center gap-4 border-t border-outline-variant pt-4">
						<a
							href={article.url}
							target="_blank"
							rel="noreferrer"
							onClick={(e) => e.stopPropagation()}
							className="inline-flex items-center gap-1 font-label text-label-sm uppercase tracking-wide text-secondary transition-colors hover:text-primary hover:underline"
						>
							<Icon name="open_in_new" className="text-[14px]" />
							Read source
						</a>
						<span className="font-mono text-[11px] text-on-tertiary-container">
							{sourceNameLabel(sourceNames)}
						</span>
					</div>
				</div>
			</div>
		</article>
	);
}

function Field({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div className="space-y-1">
			<h4 className="font-label text-label-md uppercase tracking-wide text-on-surface-variant">
				{label}
			</h4>
			<p className="text-on-surface" dir="auto">
				{children}
			</p>
		</div>
	);
}

function tierLabel(tier: BriefEntry["importanceTier"]): string {
	switch (tier) {
		case "signal":
			return "Signal";
		case "trend":
			return "Trend";
		case "low-noise":
			return "Low Noise";
		default:
			return "Info";
	}
}

/** Trim + ellipsize content into a standfirst when no LLM summary exists. */
function snippet(content: string, max = 220): string {
	const text = (content ?? "").replace(/\s+/g, " ").trim();
	if (!text) return "";
	return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

/** Short "on {source}" label for the source link row. */
function sourceNameLabel(sourceNames: string[]): string {
	if (sourceNames.length === 0) return "original article";
	if (sourceNames.length === 1) return `on ${sourceNames[0]}`;
	return `on ${sourceNames[0]} +${sourceNames.length - 1} more`;
}

function timeAgo(date: Date): string {
	const ms = Date.now() - new Date(date).getTime();
	const h = ms / 3_600_000;
	if (h < 1) return `${Math.max(1, Math.round(h * 60))}m ago`;
	if (h < 24) return `${Math.round(h)}h ago`;
	const d = h / 24;
	if (d < 7) return `${Math.round(d)}d ago`;
	return new Date(date).toLocaleDateString("en-US", {
		day: "numeric",
		month: "short",
	});
}
