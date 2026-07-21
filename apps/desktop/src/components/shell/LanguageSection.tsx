import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { useLocaleStore } from "@/i18n/locale-store.js";
import type { TranslationCatalog } from "@/i18n/en.js";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { DomainTag } from "@/components/ui/Badge";
import { GhostCard } from "@/components/ui/GhostCard";

/**
 * Language section of Settings.
 *
 * Ships English only. The user adds any other language (incl. RTL) by:
 *   1. Exporting the English catalog as JSON.
 *   2. Translating it in any editor.
 *   3. Importing the translated JSON back.
 *
 * Direction (ltr/rtl) is derived from the locale code, so an imported
 * `fa.json` lays out RTL automatically with no extra metadata.
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
		active,
		setActive,
		registerCatalog,
		removeCatalog,
		exportEnglish,
	} = useLocaleStore();
	const fileRef = useRef<HTMLInputElement>(null);

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
				alert(
					"Invalid catalog JSON. Make sure it's a Vorynth en.json you translated.",
				);
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

			{/* Available locales */}
			<div className="mb-4 space-y-2">
				{locales.map((loc) => (
					<div
						key={loc.code}
						className="flex items-center gap-3 border border-outline-variant px-4 py-3 rounded"
					>
						<button
							onClick={() => {
								setActive(loc.code);
								onLocaleChange?.(loc.code);
							}}
							className={`flex items-center gap-3 ${
								active === loc.code ? "text-primary" : "text-on-surface-variant"
							}`}
						>
							<span
								className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
									active === loc.code
										? "border-primary"
										: "border-outline-variant"
								}`}
							>
								{active === loc.code ? (
									<span className="h-2 w-2 rounded-full bg-primary" />
								) : null}
							</span>
							<span className="font-label text-label-md">{loc.label}</span>
						</button>
						<DomainTag>{loc.direction.toUpperCase()}</DomainTag>
						<DomainTag>
							{loc.builtIn ? t("settings.builtIn") : t("settings.custom")}
						</DomainTag>
						{!loc.builtIn ? (
							<button
								onClick={() => removeCatalog(loc.code)}
								className="ml-auto p-2 text-on-surface-variant hover:text-error"
								aria-label={t("settings.remove")}
							>
								<Icon name="delete" className="text-[18px]" />
							</button>
						) : null}
						{loc.builtIn && active === loc.code ? (
							<span className="ml-auto font-label text-label-sm uppercase text-secondary">
								{t("settings.active")}
							</span>
						) : null}
					</div>
				))}
			</div>

			<input
				ref={fileRef}
				type="file"
				accept="application/json,.json"
				onChange={handleImport}
				className="hidden"
			/>
			<div className="flex flex-wrap gap-2">
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

			<p className="mt-4 font-mono text-[11px] text-on-tertiary-container">
				Export gives you <code className="text-secondary">vorynth-en.json</code>
				. Translate every value, keep the keys, save as e.g.{" "}
				<code className="text-secondary">fa.json</code>, and import — Vorynth
				will lay out RTL automatically.
			</p>
		</GhostCard>
	);
}
