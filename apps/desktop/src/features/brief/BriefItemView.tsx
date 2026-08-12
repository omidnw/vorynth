import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import type { BriefEntry } from "@vorynth/types";
import {
	BriefItemView as BriefItemViewBase,
	type BriefItemLabels,
} from "@vorynth/ui";
import { useTranslation, useTextDirection } from "@/i18n";
import { useBookmarkToggle } from "@/features/archive/use-bookmark.js";
import { fetchProfile } from "@/features/profile/profile-api.js";
import { fetchSettings } from "@/features/history/history-api.js";
import { generateArticleInsight } from "@/features/reader/reader-api.js";
import { useJobsStore } from "@/features/jobs/jobs-store.js";
import { aiErrorMessage } from "@/features/llm/ai-error.js";

export type { BriefEntry };

/**
 * Track one per-story background job (v1.8.0). Starting returns the job's id;
 * `busy` stays true while that job is in the engine's active list, and
 * `onFinished` fires once it leaves it (done / error / canceled) so the brief
 * can refresh with the job's result. When the job ended in `status === "error"`,
 * `error` carries its engine message (null for done / canceled) so the card can
 * explain why the AI action failed.
 */
function usePerStoryJob(onFinished: () => void) {
	const [jobId, setJobId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const jobs = useJobsStore((s) => s.jobs);
	const finishedRef = useRef(onFinished);
	finishedRef.current = onFinished;

	const busy = jobId ? jobs.active.some((j) => j.id === jobId) : false;

	useEffect(() => {
		if (!jobId) return;
		// The job left the active list — it's done. Fire the refresh once.
		if (!busy) {
			const finished = jobs.recent.find((j) => j.id === jobId);
			setError(finished?.status === "error" ? finished.error : null);
			finishedRef.current();
			setJobId(null);
		}
	}, [jobId, busy, jobs.recent]);

	return {
		busy,
		error,
		track: (id: string | null) => {
			if (!id) {
				// Start failed (no job created — engine unreachable / rejected):
				// surface the store's failure message instead of swallowing it.
				// The polling loop resets lastError on the next successful fetch.
				const state = useJobsStore.getState?.();
				setError(state ? (state.lastError ?? null) : null);
				setJobId(null);
				return;
			}
			setError(null);
			setJobId(id);
		},
	};
}

/**
 * Desktop adapter for the shared `BriefItemView`. Restores the app coupling:
 * card click navigates to the focused view, RTL detection reads the user's
 * locale, the bookmark toggle hits the Archive API, and the toggle pills use
 * react-i18next. The shared component is pure-presentational.
 *
 * Per-story translate / Re-translate / Re-collect (v1.8.0) run as visible
 * background jobs (the jobs tray shows live progress) instead of silent
 * one-off requests — a click starts the job and the card's More menu disables
 * that action while it's running.
 *
 * `intelligenceEnabled` (v1.8.0) feeds the shared card's transparency note:
 * when a story has no AI insight, the card explains why instead of silently
 * omitting it (News mode vs not-yet-analyzed). In Intelligence mode a story
 * with a body gets a Generate pill (`POST /articles/:id/insight`) that creates
 * its analysis on demand; a story without a body shows the reason instead.
 */
export function BriefItemView({
	entry,
	intelligenceEnabled,
	dragSelectsText = true,
}: {
	entry: BriefEntry;
	intelligenceEnabled?: boolean;
	/** `ui.dragSelectsText` — when on (default) a drag selects text, not opens. */
	dragSelectsText?: boolean;
}) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { t } = useTranslation();
	const textDir = useTextDirection();
	const bookmark = useBookmarkToggle(entry.article.contentItemId);

	const refreshStory = () => {
		queryClient.invalidateQueries({ queryKey: ["reports"] });
		queryClient.invalidateQueries({ queryKey: ["article", entry.article.id] });
		queryClient.invalidateQueries({ queryKey: ["articles", entry.article.id] });
	};

	// Per-story jobs (v1.8.0) — Translate / Re-translate / Re-collect run as
	// visible background jobs so the user sees progress in the jobs tray.
	const startTranslateOne = useJobsStore((s) => s.startTranslateOne);
	const startRecollectOne = useJobsStore((s) => s.startRecollectOne);
	const translateJob = usePerStoryJob(refreshStory);
	const recollectJob = usePerStoryJob(refreshStory);

	const translate = {
		busy: translateJob.busy,
		translate: () =>
			void startTranslateOne({
				articleId: entry.article.id,
				force: false,
			}).then((job) => translateJob.track(job?.id ?? null)),
	};

	const recollect = {
		busy: recollectJob.busy,
		recollect: () =>
			void startRecollectOne({ articleId: entry.article.id }).then((job) =>
				recollectJob.track(job?.id ?? null),
			),
	};

	const retranslate = {
		busy: translateJob.busy,
		retranslate: () =>
			void startTranslateOne({
				articleId: entry.article.id,
				force: true,
			}).then((job) => translateJob.track(job?.id ?? null)),
	};

	// Why a per-story AI job failed (v1.9.0): route the engine's structured LLM
	// error code through the localized `llmError.*` messages, falling back to the
	// action's generic failure string when no code was sent.
	const translateError = translateJob.error
		? aiErrorMessage(t, translateJob.error, "article.translateFailed")
		: undefined;
	const retranslateError = translateJob.error
		? aiErrorMessage(t, translateJob.error, "article.retranslateFailed")
		: undefined;
	const recollectError = recollectJob.error
		? aiErrorMessage(t, recollectJob.error, "article.recollectFailed")
		: undefined;

	// Per-story insight generation — the card's Generate pill. On success the
	// brief is invalidated so the card re-renders with the new analysis.
	const generate = useMutation({
		mutationFn: () => generateArticleInsight(entry.article.id),
		onSuccess: refreshStory,
	});

	/**
	 * "Fully translated" = the title carries a translation AND there is no body
	 * left to translate (body empty or body translated). The pill shows whenever
	 * the story isn't fully translated — including stories that have a title but
	 * no body text (a feed item with an empty description still translates its
	 * title), and legacy title-only translations.
	 */
	const titleTranslated = Boolean(entry.article.originalTitle);
	const bodyEmpty = !entry.article.content.trim();
	const bodyTranslated = Boolean(entry.article.translatedContent);
	const fullyTranslated = titleTranslated && (bodyEmpty || bodyTranslated);

	// Same-language guard (v1.8.0): a story whose SOURCE language already equals
	// the user's intelligence language is never translated (the engine skips it
	// too) — hide the pill so the card never offers a no-op translation.
	const { data: profile } = useQuery({
		queryKey: ["profile"],
		queryFn: fetchProfile,
	});
	const targetLang = profile?.preferredIntelligenceLanguage?.toLowerCase();
	const sourceLang = entry.article.language?.toLowerCase();
	const sameLanguage = Boolean(
		sourceLang && targetLang && sourceLang === targetLang,
	);

	// v1.8.1 — the brief-wide default view (Auto / Article / Insights) from
	// the Brief page selector, passed down so the card respects it.
	const { data: appSettings } = useQuery({
		queryKey: ["app-settings"],
		queryFn: fetchSettings,
	});
	const defaultView =
		(appSettings?.["brief.defaultView"] as
			"auto" | "article" | "insights" | undefined) ?? "auto";

	// v1.9.0 — customizable footer order (Settings → General → Story card
	// actions): `ui.briefActions` is the full order, `ui.briefActionsInMore`
	// the actions moved behind the More menu. Pinned = briefActions minus inMore.
	const briefActions = Array.isArray(appSettings?.["ui.briefActions"])
		? (appSettings?.["ui.briefActions"] as string[])
		: ["readSource", "viewToggle", "save"];
	const inMoreSet = new Set(
		Array.isArray(appSettings?.["ui.briefActionsInMore"])
			? (appSettings?.["ui.briefActionsInMore"] as string[])
			: [],
	);
	const pinnedOrder = briefActions.filter((id) => !inMoreSet.has(id));

	// Re-translate (v1.8.0): every story that HAS a translation — complete or
	// incomplete — offers Re-translate, so the user can force a fresh AI pass
	// any time (after a language change, or when a translation looks off).
	// Only a never-translated story shows the plain Translate pill instead.
	const canRetranslate = bodyTranslated && !sameLanguage;

	const labels: BriefItemLabels = {
		showOriginalTitle: t("article.showOriginalTitle"),
		showTranslatedTitle: t("article.showTranslatedTitle"),
		original: t("article.original"),
		translated: t("article.translated"),
		showOriginalBody: t("article.showOriginalBody"),
		showTranslatedBody: t("article.showTranslatedBody"),
		translate: t("article.translate"),
		translating: t("article.translating"),
		translateHint: t("article.translateHint"),
		noInsightNews: t("article.noInsightNews"),
		noInsightPending: t("article.noInsightPending"),
		generateInsight: t("article.generateInsight"),
		generateInsightBusy: t("article.generateInsightBusy"),
		generateInsightHint: t("article.generateInsightHint"),
		noInsightNoContent: t("article.noInsightNoContent"),
		recollect: t("article.recollect"),
		recollecting: t("article.recollecting"),
		recollectHint: t("article.recollectHint"),
		retranslate: t("article.retranslate"),
		retranslating: t("article.retranslating"),
		retranslateHint: t("article.retranslateHint"),
		more: t("article.more"),
		moreAria: t("article.moreAria"),
		viewArticle: t("article.viewArticle"),
		viewInsights: t("article.viewInsights"),
		viewArticleHint: t("article.viewArticleHint"),
		viewInsightsHint: t("article.viewInsightsHint"),
		// v1.9.0 — footer actions that can move behind the More menu.
		readSource: t("search.readSource"),
		save: t("article.save"),
		saved: t("article.saved"),
	};

	return (
		<BriefItemViewBase
			entry={entry}
			dir={textDir}
			labels={labels}
			hideTranslation={sameLanguage}
			dragSelectsText={dragSelectsText}
			defaultView={defaultView}
			bookmark={bookmark}
			pinnedOrder={pinnedOrder}
			intelligenceEnabled={intelligenceEnabled}
			translate={{
				busy: translate.busy,
				canTranslate: !fullyTranslated && !sameLanguage,
				translate: () => translate.translate(),
				error: translateError,
			}}
			generateInsight={{
				busy: generate.isPending,
				generate: () => generate.mutate(),
				error: generate.isError
					? aiErrorMessage(t, generate.error, "article.generateInsightFailed")
					: undefined,
			}}
			recollect={{
				busy: recollect.busy,
				recollect: () => recollect.recollect(),
				error: recollectError,
			}}
			retranslate={{
				busy: retranslate.busy,
				canRetranslate: canRetranslate && !sameLanguage,
				retranslate: () => retranslate.retranslate(),
				error: retranslateError,
			}}
			onOpen={(e) => {
				if (e.insight) navigate(`/insights/${e.insight.id}`);
				else navigate(`/articles/${e.article.id}`);
			}}
		/>
	);
}
