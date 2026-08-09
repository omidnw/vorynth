import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import type { RefObject } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import type { CrossPageTopic } from "./cross-page-search.js";

/**
 * Cross-page search hint (v1.8.0) — "This setting lives on the Profile page".
 * Rendered by the Settings and Profile pages when a search query matches a
 * topic that lives on the other page; the Go button deep-links to that page's
 * section (`?section=`), which the target page scrolls to and highlights.
 *
 * When such a hint matches, it takes FOCUS priority over same-page matches on
 * commit (Enter / search button): the page scrolls to it and highlights it —
 * the thing you searched for clearly lives on the OTHER page.
 */
export function CrossPageHint({
	topic,
	highlighted = false,
	hintRef,
}: {
	topic: CrossPageTopic;
	/** Ring emphasis after the query was committed (v1.8.0). */
	highlighted?: boolean;
	/** Scroll target for the "jump to the hint" action. */
	hintRef?: RefObject<HTMLDivElement>;
}) {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const toProfile = topic.page === "/profile";

	return (
		<div
			ref={hintRef}
			className={cn(
				"mb-6 flex flex-wrap items-center gap-3 border px-4 py-3 rounded transition-shadow",
				highlighted
					? "border-primary bg-primary/10 ring-2 ring-primary"
					: "border-primary/30 bg-primary/5",
			)}
		>
			<Icon name={toProfile ? "person" : "settings"} className="text-primary" />
			<p className="min-w-0 flex-1 font-body text-body-md text-on-surface-variant">
				{t("settings.crossPageHint", {
					page: toProfile ? t("nav.profile") : t("nav.settings"),
					section: t(topic.labelKey),
				})}
			</p>
			<Button
				size="sm"
				icon={toProfile ? "person" : "settings"}
				onClick={() =>
					navigate(
						`${topic.page}?section=${encodeURIComponent(topic.sectionId)}`,
					)
				}
			>
				{t("settings.crossPageGo", {
					page: toProfile ? t("nav.profile") : t("nav.settings"),
				})}
			</Button>
		</div>
	);
}
