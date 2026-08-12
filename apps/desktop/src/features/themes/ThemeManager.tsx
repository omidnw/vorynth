import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { PluginTheme } from "@vorynth/types";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
	getThemeDefinition,
	registerUserTheme,
	unregisterUserTheme,
	useThemeStore,
	userThemes,
} from "@/lib/theme/theme-store.js";
import {
	downloadThemeJson,
	parseThemeJson,
	themeAiPrompt,
	themeFromDom,
	themeToJson,
} from "./theme-io.js";

/**
 * Custom-theme manager (v1.8.0) — the "give it to an AI / import / edit /
 * delete" surface in Settings → Appearance.
 *
 * Plugin themes keep working exactly as before; user themes are the same
 * `PluginTheme` shape, stored on this device (localStorage). The AI flow
 * captures the ACTIVE theme (any theme — including the built-ins, whose
 * applied tokens are read live from the DOM) into JSON, hands the user a
 * ready prompt, and Import accepts the LLM's answer back.
 */
export function ThemeManager() {
	const { t } = useTranslation();
	const activeTheme = useThemeStore((s) => s.theme);
	// Re-render when user themes change (the store bumps registryVersion).
	useThemeStore((s) => s.registryVersion);

	const [showImport, setShowImport] = useState(false);
	const [importText, setImportText] = useState("");
	const [importError, setImportError] = useState<string | null>(null);
	const [showAi, setShowAi] = useState(false);
	const [copied, setCopied] = useState(false);
	const [editFor, setEditFor] = useState<PluginTheme | null>(null);
	const [editText, setEditText] = useState("");
	const [deleteFor, setDeleteFor] = useState<string | null>(null);
	const fileInput = useRef<HTMLInputElement>(null);

	/** The active theme's exportable definition (registry or DOM-captured). */
	const activeDefinition: PluginTheme | null =
		getThemeDefinition(activeTheme) ??
		themeFromDom(activeTheme, activeTheme === "light" ? "Light" : "Dark");

	const applyImport = (text: string) => {
		const parsed = parseThemeJson(text);
		if (!parsed.ok) {
			setImportError(t(parsed.error));
			return;
		}
		registerUserTheme(parsed.theme);
		useThemeStore.getState().setTheme(parsed.theme.id);
		setShowImport(false);
		setImportText("");
		setImportError(null);
	};

	const onPickFile = (file: File | undefined) => {
		if (!file) return;
		const reader = new FileReader();
		reader.onload = () => {
			const text = String(reader.result ?? "");
			if (showImport) {
				setImportText(text);
				setImportError(null);
			} else {
				applyImport(text);
			}
		};
		reader.readAsText(file);
	};

	const saveEdit = () => {
		const parsed = parseThemeJson(editText);
		if (!parsed.ok) {
			setImportError(t(parsed.error));
			return;
		}
		registerUserTheme(parsed.theme);
		if (useThemeStore.getState().theme === editFor?.id) {
			useThemeStore.getState().setTheme(parsed.theme.id);
		}
		setEditFor(null);
		setImportError(null);
	};

	const aiJson = activeDefinition ? themeToJson(activeDefinition) : "";
	const aiPrompt = activeDefinition ? themeAiPrompt(aiJson) : "";

	return (
		<div className="space-y-3 border-t border-outline-variant pt-4">
			{/* Actions */}
			<div className="flex flex-wrap gap-2">
				<Button
					variant="secondary"
					size="sm"
					icon="upload_file"
					onClick={() => setShowImport(true)}
				>
					{t("settings.themeImport")}
				</Button>
				<Button
					variant="secondary"
					size="sm"
					icon="auto_awesome"
					disabled={!activeDefinition}
					onClick={() => setShowAi(true)}
				>
					{t("settings.themeCustomizeAi")}
				</Button>
				<Button
					variant="ghost"
					size="sm"
					icon="download"
					disabled={!activeDefinition}
					onClick={() =>
						activeDefinition && downloadThemeJson(activeDefinition)
					}
				>
					{t("settings.themeExportCurrent")}
				</Button>
			</div>

			{/* User-imported themes */}
			{userThemes().length > 0 ? (
				<div className="space-y-2">
					<p className="font-label text-label-sm uppercase tracking-widest text-on-tertiary-container">
						{t("settings.themeCustomThemes")}
					</p>
					{userThemes().map((th) => (
						<div
							key={th.id}
							className={`flex items-center gap-2 border px-3 py-2 rounded ${
								activeTheme === th.id
									? "border-primary bg-surface-container-low"
									: "border-outline-variant"
							}`}
						>
							<Icon
								name={th.icon ?? "palette"}
								className="text-on-surface-variant"
							/>
							<span className="min-w-0 flex-1 truncate font-label text-label-sm text-on-surface">
								{th.name}
							</span>
							<ThemeRowActions
								theme={th}
								onEdit={(th2) => {
									setEditText(themeToJson(th2));
									setEditFor(th2);
									setImportError(null);
								}}
								onExport={(th2) => downloadThemeJson(th2)}
								onDelete={(th2) => setDeleteFor(th2.id)}
							/>
						</div>
					))}
				</div>
			) : null}

			{/* Import dialog */}
			{showImport ? (
				<ThemeOverlay
					title={t("settings.themeImportDialogTitle")}
					onClose={() => {
						setShowImport(false);
						setImportError(null);
					}}
				>
					<p className="font-body text-body-md text-on-surface-variant">
						{t("settings.themeImportBody")}
					</p>
					<textarea
						dir="auto"
						value={importText}
						onChange={(e) => {
							setImportText(e.target.value);
							setImportError(null);
						}}
						placeholder={t("settings.themePastePlaceholder")}
						spellCheck={false}
						className="h-40 w-full border border-outline-variant bg-transparent px-3 py-2 font-mono text-mono-technical text-on-surface outline-none transition-colors placeholder:text-on-tertiary-container focus:border-secondary"
					/>
					<input
						ref={fileInput}
						type="file"
						accept=".json,application/json"
						className="hidden"
						onChange={(e) => onPickFile(e.target.files?.[0])}
					/>
					<div className="flex flex-wrap items-center gap-2">
						<Button
							variant="ghost"
							size="sm"
							icon="folder_open"
							onClick={() => fileInput.current?.click()}
						>
							{t("settings.themePickFile")}
						</Button>
						{importError ? (
							<p className="flex-1 font-body text-body-sm text-error">
								{importError}
							</p>
						) : null}
					</div>
					<div className="mt-3 flex justify-end gap-2">
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setShowImport(false)}
						>
							{t("common.cancel")}
						</Button>
						<Button
							size="sm"
							icon="check"
							disabled={importText.trim().length === 0}
							onClick={() => applyImport(importText)}
						>
							{t("settings.themeImportAction")}
						</Button>
					</div>
				</ThemeOverlay>
			) : null}

			{/* AI-customize dialog */}
			{showAi && activeDefinition ? (
				<ThemeOverlay
					title={t("settings.themeAiDialogTitle")}
					onClose={() => setShowAi(false)}
				>
					<p className="font-body text-body-md text-on-surface-variant">
						{t("settings.themeAiBody")}
					</p>
					<p className="font-label text-label-sm uppercase tracking-widest text-on-tertiary-container">
						{t("settings.themeAiPromptLabel")}
					</p>
					<div className="flex items-start gap-2">
						<pre
							dir="auto"
							className="max-h-48 flex-1 overflow-auto whitespace-pre-wrap rounded border border-outline-variant bg-surface-container-lowest p-3 font-mono text-[11px] leading-relaxed text-on-surface-variant"
						>
							{aiPrompt}
						</pre>
						<Button
							variant="secondary"
							size="sm"
							icon={copied ? "check" : "content_copy"}
							onClick={() => {
								void navigator.clipboard
									.writeText(aiPrompt)
									.then(() => {
										setCopied(true);
										setTimeout(() => setCopied(false), 2000);
									})
									.catch(() => undefined);
							}}
						>
							{copied ? t("settings.themeAiCopied") : t("settings.themeAiCopy")}
						</Button>
					</div>
					<p className="mt-2 font-label text-label-sm uppercase tracking-widest text-on-tertiary-container">
						{t("settings.themeAiJsonLabel")}
					</p>
					<pre
						dir="auto"
						className="max-h-48 overflow-auto whitespace-pre-wrap rounded border border-outline-variant bg-surface-container-lowest p-3 font-mono text-[11px] leading-relaxed text-on-surface-variant"
					>
						{aiJson}
					</pre>
				</ThemeOverlay>
			) : null}

			{/* Edit dialog */}
			{editFor ? (
				<ThemeOverlay
					title={t("settings.themeEditDialogTitle")}
					onClose={() => setEditFor(null)}
				>
					<p className="font-body text-body-md text-on-surface-variant">
						{t("settings.themeEditBody")}
					</p>
					<textarea
						dir="auto"
						value={editText}
						onChange={(e) => {
							setEditText(e.target.value);
							setImportError(null);
						}}
						spellCheck={false}
						className="h-56 w-full border border-outline-variant bg-transparent px-3 py-2 font-mono text-mono-technical text-on-surface outline-none transition-colors placeholder:text-on-tertiary-container focus:border-secondary"
					/>
					{importError ? (
						<p className="font-body text-body-sm text-error">{importError}</p>
					) : null}
					<div className="mt-3 flex justify-end gap-2">
						<Button variant="ghost" size="sm" onClick={() => setEditFor(null)}>
							{t("common.cancel")}
						</Button>
						<Button size="sm" icon="check" onClick={saveEdit}>
							{t("settings.themeEditSave")}
						</Button>
					</div>
				</ThemeOverlay>
			) : null}

			{/* Delete confirmation */}
			<ConfirmDialog
				open={deleteFor !== null}
				title={t("settings.themeDelete")}
				message={t("settings.themeDeleteConfirm")}
				confirmLabel={t("settings.themeDelete")}
				cancelLabel={t("common.cancel")}
				onConfirm={() => {
					if (deleteFor) unregisterUserTheme(deleteFor);
					setDeleteFor(null);
				}}
				onCancel={() => setDeleteFor(null)}
				icon="palette"
				danger
			/>
		</div>
	);
}

/** Per-custom-theme row actions (icon buttons with aria-labels). */
function ThemeRowActions({
	theme,
	onEdit,
	onExport,
	onDelete,
}: {
	theme: PluginTheme;
	onEdit: (t: PluginTheme) => void;
	onExport: (t: PluginTheme) => void;
	onDelete: (t: PluginTheme) => void;
}) {
	const { t } = useTranslation();
	return (
		<div className="flex items-center gap-1">
			<IconButton
				icon="edit"
				label={t("settings.themeEdit")}
				onClick={() => onEdit(theme)}
			/>
			<IconButton
				icon="download"
				label={t("settings.themeExport")}
				onClick={() => onExport(theme)}
			/>
			<IconButton
				icon="delete"
				label={t("settings.themeDelete")}
				onClick={() => onDelete(theme)}
			/>
		</div>
	);
}

function IconButton({
	icon,
	label,
	onClick,
}: {
	icon: string;
	label: string;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-label={label}
			title={label}
			className="p-1.5 text-on-surface-variant transition-colors hover:text-primary"
		>
			<Icon name={icon} className="text-[18px]" />
		</button>
	);
}

/** Small centered overlay used by the import / AI / edit dialogs. */
function ThemeOverlay({
	title,
	onClose,
	children,
}: {
	title: string;
	onClose: () => void;
	children: React.ReactNode;
}) {
	return (
		<div
			className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-6 backdrop-blur-[1px]"
			role="dialog"
			aria-modal="true"
			onClick={(e) => {
				if (e.target === e.currentTarget) onClose();
			}}
		>
			<div className="flex max-h-[85vh] w-full max-w-lg flex-col gap-3 overflow-y-auto rounded-lg border border-outline-variant bg-surface-container p-6 shadow-2xl">
				<h2 className="font-headline text-headline-sm text-on-surface">
					{title}
				</h2>
				{children}
			</div>
		</div>
	);
}
