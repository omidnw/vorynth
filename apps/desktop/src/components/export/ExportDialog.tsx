import { useEffect } from "react";
import type { ExportableContent } from "@vorynth/types";
import { useTranslation } from "react-i18next";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { Icon } from "@/components/ui/Icon";
import { usePluginStoryExports } from "@/plugins/plugin-hooks";

/**
 * Shared export dialog (v1.8.0).
 *
 * Renders the exporter plugin's panel(s) (Story Renderer: Markdown / themed
 * HTML / screenshot) for ANY exportable content — an article, an AI insight,
 * an Ask-AI answer, a history entry, or a period briefing. Pages build the
 * generic `ExportableContent` and open this dialog.
 *
 * Closes three ways (R-A12, R-D07): the top-right ✕, the Escape key, or a
 * click on the dimmed backdrop — the plugin panels' own Close buttons call the
 * same `onClose`.
 */
export function ExportDialog({
	content,
	onClose,
}: {
	content: ExportableContent;
	onClose: () => void;
}) {
	const { t } = useTranslation();
	const exporters = usePluginStoryExports();

	// Escape closes the dialog — keyboard parity with the visible ✕ button.
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [onClose]);

	return (
		<div
			className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-6"
			onClick={(e) => {
				if (e.target === e.currentTarget) onClose();
			}}
		>
			<div
				role="dialog"
				aria-modal="true"
				aria-label={t("export.exportTitle")}
				className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-outline-variant bg-surface shadow-2xl"
			>
				{/* Header — neutral title + visible close button. */}
				<div className="flex flex-none items-center justify-between gap-3 border-b border-outline-variant px-6 py-4">
					<h2 className="flex items-center gap-2 font-headline text-headline-sm text-primary dark:text-primary-fixed">
						<Icon name="file_download" className="text-[20px]" />
						{t("export.exportTitle")}
					</h2>
					<button
						type="button"
						autoFocus
						onClick={onClose}
						aria-label={t("export.closeAria")}
						className="rounded p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-primary"
					>
						<Icon name="close" className="text-[20px]" />
					</button>
				</div>
				<ScrollArea fadeClassName="from-surface" className="p-6">
					{exporters.map(({ pluginId, Component }) => (
						<Component key={pluginId} content={content} onClose={onClose} />
					))}
				</ScrollArea>
			</div>
		</div>
	);
}
