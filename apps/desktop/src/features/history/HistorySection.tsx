import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Icon } from "@/components/ui/Icon";
import { GhostCard } from "@/components/ui/GhostCard";
import { cn } from "@/lib/cn";
import { fetchSettings, patchSettings } from "./history-api.js";

/**
 * Settings section: controls what gets recorded into the History drawer.
 *
 * Ask-AI searches are saved by default (they cost tokens, so they're worth
 * revisiting). Keyword searches are opt-in (cheap, low signal). Both toggles
 * are backed by the engine's `app_settings` table.
 */
export function HistorySection() {
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
				History
			</h3>
			<p className="mb-4 font-body text-body-md text-on-surface-variant">
				Choose what gets saved to the History drawer. Saved entries can be
				renamed, archived, or deleted at any time.
			</p>

			<Toggle
				icon="auto_awesome"
				label="Save Ask AI searches"
				hint="Ask-AI answers cost tokens — keep them so you can revisit without re-running."
				checked={recordAi}
				onChange={(v) => update("history.search.recordAi", v)}
			/>
			<Toggle
				icon="search"
				label="Save keyword searches"
				hint="Keyword searches are fast and free — off by default to keep history focused."
				checked={recordKeyword}
				onChange={(v) => update("history.search.recordKeyword", v)}
			/>
		</GhostCard>
	);
}

function Toggle({
	icon,
	label,
	hint,
	checked,
	onChange,
}: {
	icon: string;
	label: string;
	hint: string;
	checked: boolean;
	onChange: (v: boolean) => void;
}) {
	return (
		<div className="flex items-start justify-between gap-4 py-3">
			<div className="flex items-start gap-3">
				<Icon
					name={icon}
					className="mt-0.5 text-[18px] text-on-surface-variant"
				/>
				<div>
					<p className="font-label text-label-md text-on-surface">{label}</p>
					<p className="font-body text-body-sm text-on-surface-variant">
						{hint}
					</p>
				</div>
			</div>
			<button
				type="button"
				role="switch"
				aria-checked={checked}
				aria-label={label}
				onClick={() => onChange(!checked)}
				className={cn(
					"relative h-6 w-11 flex-none rounded-full transition-colors",
					checked ? "bg-primary" : "bg-surface-variant",
				)}
			>
				<span
					className={cn(
						"absolute top-0.5 h-5 w-5 rounded-full bg-surface-container-lowest transition-all",
						checked ? "left-[22px]" : "left-0.5",
					)}
				/>
			</button>
		</div>
	);
}
