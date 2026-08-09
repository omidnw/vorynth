import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { GhostCard } from "@/components/ui/GhostCard";
import { Icon } from "@/components/ui/Icon";
import { Select, type SelectOption } from "@/components/ui/Select";
import {
	fetchSettings,
	patchSettings,
} from "@/features/history/history-api.js";
import type { AppSettings } from "@vorynth/types";

/**
 * Period-summary original-language setting (v1.8.0).
 *
 * The Generate Brief summary is generated in your AI output language; this
 * chooses the language of its ORIGINAL version — "Auto" picks the majority
 * language of the stories in the summary, or you can pin a specific language.
 */
function summaryLanguages(t: (key: string) => string): SelectOption[] {
	return [
		{ value: "auto", label: t("summaryLanguage.auto") },
		{ value: "en", label: "English" },
		{ value: "fa", label: "Persian (فارسی)" },
		{ value: "de", label: "German" },
		{ value: "fr", label: "French" },
		{ value: "es", label: "Spanish" },
		{ value: "tr", label: "Turkish" },
		{ value: "ar", label: "Arabic" },
	];
}

export function SummaryLanguageSection() {
	const queryClient = useQueryClient();
	const { t } = useTranslation();
	const { data: settings } = useQuery({
		queryKey: ["app-settings"],
		queryFn: fetchSettings,
	});
	const patch = useMutation({
		mutationFn: (changes: Partial<AppSettings>) => patchSettings(changes),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: ["app-settings"] }),
	});

	const originalLanguage =
		(settings?.["intelligence.summaryOriginalLanguage"] as
			string | undefined) ?? "auto";

	return (
		<GhostCard>
			<h3 className="mb-2 flex items-center gap-2 font-label text-label-md uppercase tracking-widest text-on-surface-variant">
				<Icon name="summarize" className="text-base" />
				{t("settings.summaryLanguageTitle")}
			</h3>
			<label className="mb-1 block font-body text-body-sm text-on-surface">
				{t("settings.summaryOriginalLanguage")}
			</label>
			<Select
				value={originalLanguage}
				onChange={(value) =>
					patch.mutate({ "intelligence.summaryOriginalLanguage": value })
				}
				options={summaryLanguages(t)}
				aria-label={t("settings.summaryOriginalLanguage")}
			/>
			<p className="mt-2 font-body text-body-sm text-on-surface-variant">
				{t("settings.summaryOriginalLanguageHint")}
			</p>
		</GhostCard>
	);
}
