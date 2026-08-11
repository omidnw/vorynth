import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { StoryViewScope } from "@vorynth/types";
import { GhostCard } from "@/components/ui/GhostCard";
import { Icon } from "@/components/ui/Icon";
import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/cn";
import { fetchStoryViews, setStoryViewRead } from "./story-views-api.js";

/**
 * Story-view history (v1.8.0) — the Brief page's History tab.
 *
 * Lists which stories the user opened and when, with a badge for what they
 * saw: the AI insight page, the article, or both in one sitting. v1.8.1 —
 * opening a story marks its view read, and each row shows a check icon the
 * user can toggle (the persisted "Mark read" state).
 */
export function StoryViewHistory({
	onOpen,
}: {
	/** Override the row click (e.g. inside the history drawer — close + go). */
	onOpen?: (articleId: string) => void;
}) {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { data, isLoading } = useQuery({
		queryKey: ["story-views"],
		queryFn: () => fetchStoryViews(100),
	});
	const views = data?.views ?? [];

	const toggleRead = useMutation({
		mutationFn: ({ id, read }: { id: number; read: boolean }) =>
			setStoryViewRead(id, read),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: ["story-views"] }),
	});

	return (
		<div className="space-y-4">
			<div>
				<h2 className="font-headline text-headline-md text-primary dark:text-primary-fixed">
					{t("storyViews.title")}
				</h2>
				<p className="font-body text-body-sm text-on-surface-variant">
					{t("storyViews.subtitle")}
				</p>
			</div>

			{isLoading ? (
				<p className="font-body text-body-sm text-on-surface-variant">
					{t("article.loading")}
				</p>
			) : views.length === 0 ? (
				<GhostCard className="flex flex-col items-center gap-2 p-8 text-center">
					<Icon
						name="history"
						className="text-[28px] text-on-tertiary-container"
					/>
					<p className="font-body text-body-md text-on-surface-variant">
						{t("storyViews.empty")}
					</p>
				</GhostCard>
			) : (
				<ul className="space-y-2">
					{views.map((v) => (
						<li key={v.id}>
							<GhostCard
								interactive
								onClick={() =>
									onOpen
										? onOpen(v.articleId)
										: navigate(`/articles/${v.articleId}`)
								}
								className="flex items-center gap-3 p-4"
							>
								<div className="min-w-0 flex-1">
									<p className="truncate font-body text-body-md font-medium text-on-surface">
										{v.articleTitle}
									</p>
									<p className="mt-0.5 font-mono text-[11px] text-on-tertiary-container">
										{new Date(v.viewedAt).toLocaleString()}
									</p>
								</div>
								<ScopeBadge scope={v.scope} />
								{/* v1.8.1 — the persisted read state; toggle it here or in
								    the reader ("Mark read" / "Read"). */}
								<Tooltip
									label={
										v.read
											? t("storyViews.markUnreadAria")
											: t("storyViews.markReadAria")
									}
									position="bottom"
								>
									<button
										type="button"
										aria-pressed={v.read}
										aria-label={
											v.read
												? t("storyViews.markUnreadAria")
												: t("storyViews.markReadAria")
										}
										onClick={(e) => {
											e.stopPropagation();
											toggleRead.mutate({ id: v.id, read: !v.read });
										}}
										className="flex h-7 w-7 flex-none items-center justify-center rounded p-1 text-on-surface-variant transition-colors hover:text-primary"
									>
										<Icon
											name="check_circle"
											fill={v.read}
											className={
												v.read ? "text-secondary" : "text-on-tertiary-container"
											}
										/>
									</button>
								</Tooltip>
							</GhostCard>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

/** What the user saw in that sitting — insight page, article, or both. */
function ScopeBadge({ scope }: { scope: StoryViewScope }) {
	const { t } = useTranslation();
	const meta =
		scope === "insight"
			? {
					icon: "auto_awesome",
					label: t("storyViews.scopeInsight"),
					cls: "bg-primary-container text-on-primary-container",
				}
			: scope === "article"
				? {
						icon: "article",
						label: t("storyViews.scopeArticle"),
						cls: "bg-surface-variant text-on-surface-variant",
					}
				: {
						icon: "menu_book",
						label: t("storyViews.scopeBoth"),
						cls: "bg-secondary-container text-on-secondary-container",
					};
	return (
		<span
			className={cn(
				"inline-flex flex-none items-center gap-1 rounded px-2 py-0.5 font-label text-[10px] uppercase tracking-widest",
				meta.cls,
			)}
		>
			<Icon name={meta.icon} className="text-[12px]" />
			{meta.label}
		</span>
	);
}
