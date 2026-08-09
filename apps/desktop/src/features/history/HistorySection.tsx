import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/ui/Icon";
import { GhostCard } from "@/components/ui/GhostCard";
import { Toggle } from "@/components/ui/Toggle";
import { fetchSettings, patchSettings } from "./history-api.js";

/**
 * Settings section: controls what gets recorded into the History drawer.
 *
 * Ask-AI searches are saved by default (they cost tokens, so they're worth
 * revisiting). Keyword searches are opt-in (cheap, low signal). Both toggles
 * are backed by the engine's `app_settings` table.
 */
export function HistorySection() {
	const { t } = useTranslation();
	const qc = useQueryClient();
	const { data: settings } = useQuery({
		queryKey: ["app-settings"],
		queryFn: fetchSettings,
		staleTime: 15_000,
	});

	const recordAi = settings?.["history.search.recordAi"] ?? true;
	const recordKeyword = settings?.["history.search.recordKeyword"] ?? false;

	const update = (
		key: "history.search.recordAi" | "history.search.recordKeyword",
		value: boolean,
	) => {
		void patchSettings({ [key]: value }).then(() => {
			void qc.invalidateQueries({ queryKey: ["app-settings"] });
		});
	};

	return (
		<GhostCard>
			<h3 className="mb-4 flex items-center gap-2 font-label text-label-md uppercase tracking-widest text-on-surface-variant">
				<Icon name="history" className="text-base" />
				{t("nav.history")}
			</h3>
			<p className="mb-4 font-body text-body-md text-on-surface-variant">
				{t("history.recordBody")}
			</p>

			<Toggle
				icon="auto_awesome"
				label={t("history.recordAi")}
				hint={t("history.recordAiHint")}
				checked={recordAi}
				onChange={(v) => update("history.search.recordAi", v)}
			/>
			<Toggle
				icon="search"
				label={t("history.recordKeyword")}
				hint={t("history.recordKeywordHint")}
				checked={recordKeyword}
				onChange={(v) => update("history.search.recordKeyword", v)}
			/>
		</GhostCard>
	);
}
