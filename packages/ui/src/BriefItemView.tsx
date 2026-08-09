import { useEffect, useRef, useState } from "react";
import type { BriefEntry } from "@vorynth/types";
import { Icon } from "./Icon";
import { ImportanceBadge, DomainTag } from "./Badge";
import { useClickNotDrag } from "./lib/useClickNotDrag";

/** Text direction ("ltr" | "rtl" | "auto"), matching the desktop i18n type. */
export type TextDirection = "ltr" | "rtl" | "auto";

export interface BookmarkState {
	saved: boolean;
	enabled: boolean;
	toggle: () => void;
}

/**
 * Per-story translate state (v1.8.0). The desktop wires this to the engine's
 * `POST /articles/:id/translate`; the pill only renders while the story has
 * content and no translation yet.
 */
export interface TranslateState {
	busy: boolean;
	/** Whether this story can be translated right now (has content, no translation yet). */
	canTranslate: boolean;
	translate: () => void;
	/** Inline error text when the last attempt failed, else undefined. */
	error?: string;
}

/**
 * Per-story insight generation (v1.8.0). The desktop wires this to
 * `POST /articles/:id/insight`; the Generate pill only renders next to the
 * "analysis hasn't run yet" note and only for stories that have a body to
 * analyze.
 */
export interface GenerateInsightState {
	busy: boolean;
	generate: () => void;
	/** Inline error text when the last attempt failed, else undefined. */
	error?: string;
}

/**
 * Per-story Re-collect state (v1.8.0). The desktop wires this to
 * `POST /articles/:id/recollect`; the button lives next to Save and runs the
 * full repair pipeline for one story (origin → full text → re-translate →
 * missing insight).
 */
export interface RecollectState {
	busy: boolean;
	recollect: () => void;
	/** Inline error text when the last attempt failed, else undefined. */
	error?: string;
}

/**
 * Per-story Re-translate state (v1.8.0). The pill only renders when the story's
 * stored translation is detected as incomplete (truncated / placeholders), so
 * the reader is never left staring at a broken translation with no way to fix
 * it. Wired to `POST /articles/:id/translate` with `{ force: true }`.
 */
export interface RetranslateState {
	busy: boolean;
	/** Whether a Re-translate pill should render. */
	canRetranslate: boolean;
	retranslate: () => void;
	/** Inline error text when the last attempt failed, else undefined. */
	error?: string;
}

/** Localization strings for the article toggle pills + translate pill. The
 *  desktop wires these from react-i18next; the landing passes the English
 *  defaults. */
export interface BriefItemLabels {
	showOriginalTitle: string;
	showTranslatedTitle: string;
	showOriginalBody: string;
	showTranslatedBody: string;
	original: string;
	translated: string;
	/** Per-story translate pill copy (only shown while a story has no translation). */
	translate: string;
	translating: string;
	translateHint: string;
	/** Transparency note shown on cards whose story has no AI insight. */
	noInsightNews: string;
	noInsightPending: string;
	/** Per-story insight Generate pill copy. */
	generateInsight: string;
	generateInsightBusy: string;
	generateInsightHint: string;
	/** Reason shown when a story can't be analyzed (empty body). */
	noInsightNoContent: string;
	/** Per-story Re-collect button copy (card footer, next to Save). */
	recollect: string;
	recollecting: string;
	recollectHint: string;
	/** Per-story Re-translate pill copy (translation exists but incomplete). */
	retranslate: string;
	retranslating: string;
	retranslateHint: string;
	/** Footer overflow menu (v1.8.0) — Translate/Re-translate, Re-collect, and
	 *  the Article/Insights card view all live behind "More" so the footer stays
	 *  just Read source · Save · More. */
	more: string;
	moreAria: string;
	/** Card view toggle copy (v1.8.0) — switch between the article post and the
	 *  AI insights. The label names the view you'll switch TO. */
	viewArticle: string;
	viewInsights: string;
	viewArticleHint: string;
	viewInsightsHint: string;
}

const DEFAULT_LABELS: BriefItemLabels = {
	showOriginalTitle: "Show original title",
	showTranslatedTitle: "Show translated title",
	showOriginalBody: "Show original body",
	showTranslatedBody: "Show translated body",
	original: "Original",
	translated: "Translated",
	translate: "Translate",
	translating: "Translating…",
	translateHint:
		"Translate this story's title and text into your intelligence language.",
	noInsightNews:
		"Why It Matters / Impact / Takeaway appear when an LLM provider is configured — Vorynth is in News mode.",
	noInsightPending: "AI analysis hasn't run for this story yet.",
	generateInsight: "Generate",
	generateInsightBusy: "Generating…",
	generateInsightHint:
		"Generate this story's AI analysis (Why It Matters / Impact / Takeaway).",
	noInsightNoContent:
		"Can't analyze this story — it has no body text. Re-collect the source to fetch the full article first.",
	recollect: "Re-collect",
	recollecting: "Re-collecting…",
	recollectHint:
		"Re-fetch this story's original article, refresh its full text, re-translate if needed, and generate its AI analysis.",
	retranslate: "Re-translate",
	retranslating: "Re-translating…",
	retranslateHint:
		"Run a fresh translation with new AI output — useful after changing your language, or when the current translation looks off.",
	more: "More",
	moreAria: "More story actions",
	viewArticle: "Article view",
	viewInsights: "Insights view",
	viewArticleHint: "Show this story's article post instead of the AI insights.",
	viewInsightsHint:
		"Show this story's AI insights (Why It Matters / Impact / Takeaway) instead of the raw article.",
};

/** `dir` default: treat text as LTR when the host doesn't inject detection. */
const defaultDir = (_text: string): TextDirection => "ltr";

/**
 * One ranked row in the Brief list — **news-first**. Pure-presentational:
 * navigation, RTL detection, bookmark state, and copy are all injected so the
 * component works in both the desktop app (real hooks) and a static preview
 * (the landing page).
 *
 * Always renders the article (title + source + age + summary snippet). When
 * `entry.insight` is present (an LLM analyzed this article), the intelligence
 * triad — Why it matters / Impact / Takeaway — renders underneath.
 */
export interface BriefItemViewProps {
	entry: BriefEntry;
	/** Dominant text direction for a string; defaults to LTR. */
	dir?: (text: string) => TextDirection;
	/** Card click — open the focused view. No-op by default (static preview). */
	onOpen?: (entry: BriefEntry) => void;
	/** Bookmark state; defaults to disabled+unsaved. */
	bookmark?: BookmarkState;
	/** Per-story translate pill; hidden when omitted (static preview). */
	translate?: TranslateState;
	/**
	 * Whether an LLM is configured + Intelligence mode is on. When provided,
	 * cards without an AI insight show a transparent note explaining why
	 * (News mode vs not-yet-analyzed). Omitted (undefined) → no note.
	 */
	intelligenceEnabled?: boolean;
	/** Per-story insight Generate pill; hidden when omitted (static preview). */
	generateInsight?: GenerateInsightState;
	/**
	 * Per-story Re-collect button (card footer, next to Save); hidden when
	 * omitted (static preview).
	 */
	recollect?: RecollectState;
	/**
	 * Per-story Re-translate pill; renders in the title row when the story's
	 * translation is detected as incomplete. Hidden when omitted.
	 */
	retranslate?: RetranslateState;
	/**
	 * When true, the card shows the ORIGINAL title/body even if a (now-stale)
	 * translation is stored — used when the story's source language equals the
	 * user's intelligence language, so a Persian translation never shows after
	 * the user switches their intelligence language back to English.
	 */
	hideTranslation?: boolean;
	/** Toggle-pill copy; defaults to English. */
	labels?: BriefItemLabels;
	/**
	 * When true (default), dragging the mouse over the card selects text and
	 * does NOT open the story — a clean click is required. Maps to the
	 * `ui.dragSelectsText` profile setting.
	 */
	dragSelectsText?: boolean;
}

export function BriefItemView({
	entry,
	dir = defaultDir,
	onOpen,
	bookmark,
	translate,
	intelligenceEnabled,
	generateInsight,
	recollect,
	retranslate,
	hideTranslation = false,
	labels = DEFAULT_LABELS,
	dragSelectsText = true,
}: BriefItemViewProps) {
	const { article, insight, sourceNames, category, importanceTier } = entry;
	const rankLabel = String(entry.rank).padStart(2, "0");
	const hasIntelligence = Boolean(insight);
	const bm: BookmarkState = bookmark ?? {
		saved: false,
		enabled: false,
		toggle: () => {},
	};

	const headline = insight?.summary?.split("\n")[0] || article.title;
	const hasOriginalTitle = Boolean(article.originalTitle);
	// A same-language story shows its original text, never a stale translation
	// from a previous intelligence language (hideTranslation).
	const hasTranslatedBody =
		Boolean(article.translatedContent) && !hideTranslation;
	const [showOriginal, setShowOriginal] = useState(false);
	const [showOriginalBody, setShowOriginalBody] = useState(false);
	// v1.8.0 — an insight whose analysis was re-translated keeps its ORIGINAL
	// text; the triad (Why it matters / Impact / Takeaway) toggles
	// between the translation and the source-language version, mirroring the
	// article title/body toggles.
	const [showOriginalInsight, setShowOriginalInsight] = useState(false);
	// v1.8.0 — the card flips between the article post (title + raw body) and
	// the AI insights (the triad) via the footer view toggle. Insight stories
	// default to the insights view; a story without an insight is always the
	// article view and offers no toggle.
	const [view, setView] = useState<"article" | "insights">(
		hasIntelligence ? "insights" : "article",
	);
	const isInsightsView = view === "insights" && hasIntelligence;
	// Footer (v1.8.0): the source label leads, then Read source · Save · the
	// Insights/Article view toggle, with the More menu pinned to the far end.
	// The menu holds Translate/Re-translate and Re-collect; while a per-story
	// job runs (translate/recollect), the menu collapses to a spinner so the
	// user sees the work is happening.
	const [moreOpen, setMoreOpen] = useState(false);
	const moreRef = useRef<HTMLDivElement>(null);
	const jobBusy = Boolean(
		(translate?.busy ?? false) || (recollect?.busy ?? false),
	);
	// When a job starts, close the menu — the spinner takes its place.
	useEffect(() => {
		if (jobBusy) setMoreOpen(false);
	}, [jobBusy]);
	useEffect(() => {
		if (!moreOpen) return;
		const onDown = (e: MouseEvent) => {
			if (!moreRef.current?.contains(e.target as Node)) setMoreOpen(false);
		};
		document.addEventListener("mousedown", onDown);
		return () => document.removeEventListener("mousedown", onDown);
	}, [moreOpen]);

	// In the insights view the headline is the AI summary's first line (the
	// takeaway); in the article view it's the real story title.
	const displayHeadline = isInsightsView ? headline : article.title;
	const displayTitle =
		showOriginal && article.originalTitle
			? article.originalTitle
			: displayHeadline;
	// The story-text snippet defaults to the translated body when one exists
	// (mirrors the reader) — the original stays one toggle away. A damaged body
	// shows its read-time cleanup (v1.8.0) instead of raw JSON/chrome.
	const rawSnippet = snippet(
		hasTranslatedBody && !showOriginalBody
			? (article.translatedContent ?? article.content)
			: (article.contentClean ?? article.content),
	);
	const hasOriginalInsight = Boolean(
		insight?.originalSummary && insight.originalSummary !== insight.summary,
	);
	// The standfirst leads with the AI significance in the insights view and the
	// raw article text in the article view.
	const standfirst = isInsightsView
		? (showOriginalInsight &&
				hasOriginalInsight &&
				insight?.originalSignificance) ||
			insight?.significance ||
			rawSnippet
		: rawSnippet;
	const displayInsight:
		| NonNullable<typeof insight>
		| { significance: string; impact: string; recommendedAction: string } =
		showOriginalInsight && hasOriginalInsight && insight
			? {
					significance: insight.originalSignificance ?? insight.significance,
					impact: insight.originalImpact ?? insight.impact,
					recommendedAction:
						insight.originalRecommendedAction ?? insight.recommendedAction,
				}
			: insight!;
	// The body pill only makes sense when the raw story text is what's shown
	// (an AI significance paragraph is not translated source text).
	const showBodyToggle = isInsightsView
		? !insight?.significance && hasTranslatedBody
		: hasTranslatedBody;

	const openCard = () => onOpen?.(entry);
	// Guard the card click so selecting text with a drag never navigates
	// (unless the user disabled that guard in Profile — `ui.dragSelectsText`).
	const { onPointerDown, onClick: onCardClick } = useClickNotDrag(
		openCard,
		dragSelectsText,
	);

	return (
		<article
			className="group cursor-pointer"
			onPointerDown={onPointerDown}
			onClick={onCardClick}
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
							<span className="ms-auto font-mono text-mono-technical text-on-tertiary-container">
								{timeAgo(article.publishedAt)}
							</span>
						) : null}
					</div>

					{/* The row mirrors the title's direction: an RTL title (Persian,
					    Arabic, Hebrew) starts from the right and the pills trail it on
					    the left — the mirror of the LTR layout. */}
					<div className="mb-4 flex items-start gap-3" dir={dir(displayTitle)}>
						<h3
							className="font-headline text-headline-lg leading-tight text-primary dark:text-primary-fixed"
							dir={dir(displayTitle)}
						>
							{displayTitle}
						</h3>
						{hasOriginalTitle ? (
							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation();
									setShowOriginal((v) => !v);
								}}
								className="mt-1 shrink-0 rounded border border-outline-variant px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-on-tertiary-container transition-colors hover:border-secondary hover:text-secondary"
								title={
									showOriginal
										? labels.showTranslatedTitle
										: labels.showOriginalTitle
								}
							>
								{showOriginal ? labels.translated : labels.original}
							</button>
						) : null}
					</div>
					{translate?.error ? (
						<p className="mb-4 font-body text-body-sm text-error">
							{translate.error}
						</p>
					) : null}
					<div className="mb-6 h-0.5 w-12 bg-primary" />

					{/* Mirrors the snippet's direction like the title row: an RTL
					    snippet leads from the right and the body toggle trails left. */}
					<div className="mb-8 flex items-start gap-3" dir={dir(standfirst)}>
						<p
							className="flex-1 font-body text-body-lg leading-relaxed text-on-surface"
							dir={dir(standfirst)}
						>
							{standfirst}
						</p>
						{showBodyToggle ? (
							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation();
									setShowOriginalBody((v) => !v);
								}}
								className="mt-1 shrink-0 rounded border border-outline-variant px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-on-tertiary-container transition-colors hover:border-secondary hover:text-secondary"
								title={
									showOriginalBody
										? labels.showTranslatedBody
										: labels.showOriginalBody
								}
							>
								{showOriginalBody ? labels.translated : labels.original}
							</button>
						) : null}
					</div>

					{isInsightsView && insight ? (
						<div>
							{/* The insight triad carries its own Original/Translated toggle
							    when the analysis was re-translated (v1.8.0) — the same
							    affordance as the article title/body. */}
							{hasOriginalInsight ? (
								<div className="mb-3 flex justify-end">
									<button
										type="button"
										onClick={(e) => {
											e.stopPropagation();
											setShowOriginalInsight((v) => !v);
										}}
										className="shrink-0 rounded border border-outline-variant px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-on-tertiary-container transition-colors hover:border-secondary hover:text-secondary"
										title={
											showOriginalInsight
												? labels.showTranslatedBody
												: labels.showOriginalBody
										}
									>
										{showOriginalInsight ? labels.translated : labels.original}
									</button>
								</div>
							) : null}
							<div className="grid grid-cols-1 gap-8 font-body text-body-md md:grid-cols-2">
								<div className="space-y-4">
									<Field
										label="Why it matters"
										dir={dir(displayInsight.significance || "")}
									>
										{displayInsight.significance || "—"}
									</Field>
									<Field label="Impact" dir={dir(displayInsight.impact || "")}>
										{displayInsight.impact || "—"}
									</Field>
									{sourceNames.length > 0 ? (
										<Field label="Sources" dir={dir(sourceNames.join(" · "))}>
											{sourceNames.join(" · ")}
										</Field>
									) : null}
								</div>
								<div className="border-s-2 border-s-primary bg-surface-container-low p-6 rounded">
									<h4 className="mb-2 flex items-center gap-2 font-label text-label-md uppercase tracking-wide text-on-surface-variant">
										<Icon name="lightbulb" fill className="text-[16px]" />
										Takeaway
									</h4>
									<p
										className="italic text-on-surface"
										dir={dir(displayInsight.recommendedAction || "")}
									>
										{displayInsight.recommendedAction || "—"}
									</p>
								</div>
							</div>
						</div>
					) : (
						<div className="space-y-2">
							<div className="flex items-center gap-2 font-mono text-mono-technical text-on-tertiary-container">
								<Icon name="open_in_new" className="text-[16px]" />
								<span>Read on {sourceNames[0] ?? "source"}</span>
							</div>
							{/* Transparency (v1.8.0): explain why this story has no AI
								    insight instead of silently omitting it. In Intelligence
								    mode, a story with a body can generate its analysis on
								    demand; one without a body gets the reason instead. Only
								    stories WITHOUT an insight get this — a story whose card is
								    on the article view still has its analysis in the More menu. */}
							{!hasIntelligence && intelligenceEnabled !== undefined ? (
								intelligenceEnabled ? (
									article.content.trim() ? (
										<div className="flex flex-wrap items-center gap-2">
											<p
												className="inline-flex items-start gap-1.5 font-body text-body-sm text-on-surface-variant"
												dir={dir(labels.noInsightPending)}
											>
												<Icon
													name="info"
													className="mt-0.5 shrink-0 text-[14px]"
												/>
												<span>{labels.noInsightPending}</span>
											</p>
											{generateInsight ? (
												<button
													type="button"
													onClick={(e) => {
														e.stopPropagation();
														generateInsight.generate();
													}}
													disabled={generateInsight.busy}
													className="inline-flex items-center gap-1 rounded border border-outline-variant px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-on-tertiary-container transition-colors hover:border-secondary hover:text-secondary disabled:opacity-60"
													title={labels.generateInsightHint}
												>
													<Icon name="auto_awesome" className="text-[12px]" />
													{generateInsight.busy
														? labels.generateInsightBusy
														: labels.generateInsight}
												</button>
											) : null}
											{generateInsight?.error ? (
												<p className="w-full font-body text-body-sm text-error">
													{generateInsight.error}
												</p>
											) : null}
										</div>
									) : (
										<p
											className="inline-flex items-start gap-1.5 font-body text-body-sm text-on-surface-variant"
											dir={dir(labels.noInsightNoContent)}
										>
											<Icon
												name="info"
												className="mt-0.5 shrink-0 text-[14px]"
											/>
											<span>{labels.noInsightNoContent}</span>
										</p>
									)
								) : (
									<p
										className="inline-flex items-start gap-1.5 font-body text-body-sm text-on-surface-variant"
										dir={dir(labels.noInsightNews)}
									>
										<Icon name="info" className="mt-0.5 shrink-0 text-[14px]" />
										<span>{labels.noInsightNews}</span>
									</p>
								)
							) : null}
						</div>
					)}

					{/* Always-present footer (v1.8.0): Read source · Article view ·
					    Save · More, with the source label at the far end. */}
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
						{/* Card view toggle (v1.8.0) — pulled out of the More menu so
						    Insights ⇄ Article is always one tap away. The label names
						    the view you’ll switch TO. */}
						{hasIntelligence ? (
							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation();
									setView(isInsightsView ? "article" : "insights");
								}}
								title={
									isInsightsView
										? labels.viewArticleHint
										: labels.viewInsightsHint
								}
								className="inline-flex items-center gap-1 rounded p-1 font-label text-label-sm uppercase tracking-wide text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-secondary"
							>
								<Icon
									name={isInsightsView ? "article" : "insights"}
									className="text-[16px]"
								/>
								{isInsightsView ? labels.viewArticle : labels.viewInsights}
							</button>
						) : null}
						<button
							type="button"
							onClick={(e) => {
								e.stopPropagation();
								bm.toggle();
							}}
							disabled={!bm.enabled}
							aria-label={bm.saved ? "Remove bookmark" : "Bookmark this story"}
							aria-pressed={bm.saved}
							className="inline-flex items-center gap-1 rounded p-1 font-label text-label-sm uppercase tracking-wide text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-primary disabled:opacity-30"
						>
							<Icon
								name={bm.saved ? "bookmark" : "bookmark_border"}
								fill={bm.saved}
								className="text-[16px]"
							/>
							{bm.saved ? "Saved" : "Save"}
						</button>
						{/* Overflow menu (v1.8.0): Translate/Re-translate and
						    Re-collect live behind More — sits right before Save. While
						    a per-story job runs, the menu shows a spinner instead of
						    offering the action again. */}
						<div ref={moreRef} className="relative">
							<button
								type="button"
								aria-label={labels.moreAria}
								aria-haspopup="menu"
								aria-expanded={moreOpen}
								disabled={jobBusy}
								onClick={(e) => {
									e.stopPropagation();
									setMoreOpen((v) => !v);
								}}
								className="inline-flex items-center gap-1 rounded p-1 font-label text-label-sm uppercase tracking-wide text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-secondary disabled:opacity-60"
							>
								{jobBusy ? (
									<Icon
										name="sync"
										className="animate-spin-reverse text-[16px]"
									/>
								) : (
									<Icon name="more_vert" className="text-[16px]" />
								)}
								{labels.more}
							</button>
							{moreOpen ? (
								<div
									role="menu"
									className="absolute bottom-full end-0 z-50 mb-1 min-w-[11rem] overflow-hidden rounded border border-outline-variant bg-surface-container-lowest py-1 shadow-lg"
								>
									{translate && (translate.canTranslate || translate.busy) ? (
										<button
											type="button"
											role="menuitem"
											onClick={(e) => {
												e.stopPropagation();
												setMoreOpen(false);
												translate.translate();
											}}
											disabled={translate.busy}
											className="flex w-full items-center gap-2 px-3 py-1.5 text-start font-label text-label-sm transition-colors hover:bg-primary-container hover:text-on-primary-container disabled:opacity-60"
											title={labels.translateHint}
										>
											<Icon name="translate" className="shrink-0 text-[16px]" />
											{translate.busy ? labels.translating : labels.translate}
										</button>
									) : retranslate &&
									  (retranslate.canRetranslate || retranslate.busy) ? (
										<button
											type="button"
											role="menuitem"
											onClick={(e) => {
												e.stopPropagation();
												setMoreOpen(false);
												retranslate.retranslate();
											}}
											disabled={retranslate.busy}
											className="flex w-full items-center gap-2 px-3 py-1.5 text-start font-label text-label-sm transition-colors hover:bg-primary-container hover:text-on-primary-container disabled:opacity-60"
											title={labels.retranslateHint}
										>
											<Icon name="translate" className="shrink-0 text-[16px]" />
											{retranslate.busy
												? labels.retranslating
												: labels.retranslate}
										</button>
									) : null}
									{recollect ? (
										<button
											type="button"
											role="menuitem"
											onClick={(e) => {
												e.stopPropagation();
												setMoreOpen(false);
												recollect.recollect();
											}}
											disabled={recollect.busy}
											className="flex w-full items-center gap-2 px-3 py-1.5 text-start font-label text-label-sm transition-colors hover:bg-primary-container hover:text-on-primary-container disabled:opacity-60"
											title={labels.recollectHint}
										>
											<Icon name="refresh" className="shrink-0 text-[16px]" />
											{recollect.busy ? labels.recollecting : labels.recollect}
										</button>
									) : null}
									{translate?.error ? (
										<p className="px-3 py-1.5 font-body text-body-sm text-error">
											{translate.error}
										</p>
									) : null}
									{retranslate?.error ? (
										<p className="px-3 py-1.5 font-body text-body-sm text-error">
											{retranslate.error}
										</p>
									) : null}
									{recollect?.error ? (
										<p className="px-3 py-1.5 font-body text-body-sm text-error">
											{recollect.error}
										</p>
									) : null}
								</div>
							) : null}
						</div>
						{/* Source label at the far end — the story’s origin reads
						    right after the actions (v1.8.0). */}
						<span className="ms-auto font-mono text-[11px] text-on-tertiary-container">
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
	dir,
}: {
	label: string;
	children: React.ReactNode;
	dir?: TextDirection;
}) {
	return (
		<div className="space-y-1">
			<h4 className="font-label text-label-md uppercase tracking-wide text-on-surface-variant">
				{label}
			</h4>
			<p className="text-on-surface" dir={dir ?? "auto"}>
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

/** Trim + ellipsize content into a standfirst when no LLM summary exists. The
 *  card is a plain-text preview: feed HTML (bold, links) is stripped — the
 *  reader is where formatting actually renders. */
function snippet(content: string, max = 220): string {
	const text = (content ?? "")
		.replace(/<[^>]*>/g, " ")
		.replace(/\s+/g, " ")
		.trim();
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
