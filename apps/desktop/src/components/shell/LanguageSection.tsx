import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocaleStore } from "@/i18n/locale-store.js";
import type { TranslationCatalog } from "@/i18n/en.js";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { DomainTag } from "@/components/ui/Badge";
import { GhostCard } from "@/components/ui/GhostCard";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Select } from "@/components/ui/Select";

/**
 * Language section of the profile page.
 *
 * 10 languages ship bundled (en, fa, ar, ko, ja, zh, he, es, de, ru — see
 * `i18n/locales.ts`). The user adds any OTHER language by:
 *   1. Exporting the English catalog as JSON.
 *   2. Translating it in any editor.
 *   3. Importing the translated JSON back (an import for a bundled code
 *      overrides that bundle until removed).
 *
 * The picker is a searchable dropdown — type the native name, the English
 * name, or the code (e.g. "Persian", "فارسی", "fa") to filter.
 *
 * Direction (ltr/rtl) is derived from the locale code, so RTL locales lay out
 * automatically with no extra metadata.
 *
 * When `onLocaleChange` is provided, it's called every time the active locale
 * changes — the parent can use it to sync the preference to the backend
 * (e.g. save `preferredUiLanguage` on the user profile).
 */
export function LanguageSection({
	onLocaleChange,
}: {
	onLocaleChange?: (code: string) => void;
} = {}) {
	const { t } = useTranslation();
	const {
		locales,
		customLocales,
		active,
		setActive,
		registerCatalog,
		removeCatalog,
		exportEnglish,
	} = useLocaleStore();
	const fileRef = useRef<HTMLInputElement>(null);
	const [showError, setShowError] = useState(false);
	const [removeTarget, setRemoveTarget] = useState<string | null>(null);

	const handleExport = () => {
		const blob = new Blob([exportEnglish()], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = "vorynth-en.json";
		a.click();
		URL.revokeObjectURL(url);
	};

	const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = () => {
			try {
				const catalog = JSON.parse(String(reader.result)) as TranslationCatalog;
				// Derive locale code + label from the filename, e.g. "fa.json" → fa.
				const base = file.name.replace(/\.[^.]+$/, "").toLowerCase();
				const code = base || "custom";
				const label = catalog.app?.name
					? `${code.toUpperCase()} (imported)`
					: code.toUpperCase();
				registerCatalog(code, label, catalog);
				setActive(code);
				onLocaleChange?.(code);
			} catch {
				setShowError(true);
			}
		};
		reader.readAsText(file);
		// Reset so the same file can be re-selected.
		e.target.value = "";
	};

	return (
		<GhostCard>
			<h3 className="mb-4 flex items-center gap-2 font-label text-label-md uppercase tracking-widest text-on-surface-variant">
				<Icon name="translate" className="text-base" />
				{t("settings.language")}
			</h3>
			<p className="mb-4 font-body text-body-md text-on-surface-variant">
				{t("settings.languageHint")}
			</p>

			{/* Language picker — searchable by native name, English name, or code. */}
			<Select
				value={active}
				onChange={(code) => {
					setActive(code);
					onLocaleChange?.(code);
				}}
				aria-label={t("settings.language")}
				searchable
				searchPlaceholder={t("settings.languageSearchPlaceholder")}
				noResultsLabel={t("common.noResults")}
				options={locales.map((loc) => ({
					value: loc.code,
					label: loc.label,
					icon: "translate",
				}))}
			/>

			{/* Imported translations — removable (an import can override a bundled language). */}
			{customLocales.length > 0 ? (
				<div className="mb-4 mt-4">
					<h4 className="mb-2 font-label text-label-md uppercase tracking-widest text-on-surface-variant">
						{t("settings.importedTranslations")}
					</h4>
					<div className="space-y-2">
						{customLocales.map((loc) => (
							<div
								key={loc.code}
								className="flex items-center gap-3 border border-outline-variant px-4 py-3 rounded"
							>
								<span className="flex-1 font-label text-label-md">
									{loc.label}
								</span>
								<DomainTag>{loc.direction.toUpperCase()}</DomainTag>
								<DomainTag>{t("settings.custom")}</DomainTag>
								<button
									onClick={() => setRemoveTarget(loc.code)}
									className="p-2 text-on-surface-variant hover:text-error"
									aria-label={t("settings.remove")}
								>
									<Icon name="delete" className="text-[18px]" />
								</button>
							</div>
						))}
					</div>
				</div>
			) : null}

			<input
				ref={fileRef}
				type="file"
				accept="application/json,.json"
				onChange={handleImport}
				className="hidden"
			/>
			<div className="mt-4 flex flex-wrap gap-2">
				<Button
					variant="secondary"
					size="sm"
					icon="download"
					onClick={handleExport}
				>
					{t("settings.export")}
				</Button>
				<Button
					variant="secondary"
					size="sm"
					icon="upload"
					onClick={() => fileRef.current?.click()}
				>
					{t("settings.import")}
				</Button>
			</div>

			<p className="mt-4 font-body text-body-sm text-on-tertiary-container">
				{t("settings.languageExportNote")}
			</p>

			<ConfirmDialog
				open={showError}
				title={t("settings.importDialogTitle")}
				message={t("settings.importDialogBody")}
				confirmLabel={t("settings.ok")}
				cancelLabel={t("settings.close")}
				icon="error_outline"
				danger={false}
				onConfirm={() => setShowError(false)}
				onCancel={() => setShowError(false)}
			/>

			<ConfirmDialog
				open={Boolean(removeTarget)}
				title={t("settings.removeLanguageTitle")}
				message={t("settings.removeLanguageBody")}
				confirmLabel={t("settings.remove")}
				icon="delete"
				danger
				onConfirm={() => {
					if (removeTarget) removeCatalog(removeTarget);
					setRemoveTarget(null);
				}}
				onCancel={() => setRemoveTarget(null)}
			/>
		</GhostCard>
	);
}
