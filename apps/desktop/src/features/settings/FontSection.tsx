import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { availableFonts } from "@/plugins/asset-registry.js";
import {
	FONT_SCALE_MAX,
	FONT_SCALE_MIN,
	FONT_SCALE_STEP,
	importCustomFont,
	useFontStore,
} from "./font-store.js";

/**
 * Font customization (v1.8.0) — Settings → Appearance.
 *
 * Body font picker (the 18 offline families the Icon Pack ships + any
 * user-imported font), a global size slider (0.85–1.3), and custom-font import
 * (.woff2/.ttf/.otf — registered through the same @font-face path plugins use,
 * so it works offline). Everything persists on this device.
 */
export function FontSection() {
	const { t } = useTranslation();
	const family = useFontStore((s) => s.family);
	const scale = useFontStore((s) => s.scale);
	const setFamily = useFontStore((s) => s.setFamily);
	const setScale = useFontStore((s) => s.setScale);
	const reset = useFontStore((s) => s.reset);
	const fileInput = useRef<HTMLInputElement>(null);
	const [error, setError] = useState<string | null>(null);

	const fonts = availableFonts();
	const options = [
		{
			value: "__default__",
			label: t("settings.fontDefault"),
		},
		...fonts.map((f) => ({ value: f.family, label: f.family })),
	];

	const onImport = async (file: File | undefined) => {
		if (!file) return;
		setError(null);
		try {
			const name = await importCustomFont(file);
			setFamily(name);
		} catch {
			setError(t("settings.fontImportFailed"));
		} finally {
			if (fileInput.current) fileInput.current.value = "";
		}
	};

	return (
		<div className="space-y-4 border-t border-outline-variant pt-4">
			<div>
				<p className="font-label text-label-sm uppercase tracking-widest text-on-surface-variant">
					{t("settings.fontFamily")}
				</p>
				<Select
					aria-label={t("settings.fontFamily")}
					value={family ?? "__default__"}
					options={options}
					searchable
					searchPlaceholder={t("settings.fontSearch")}
					onChange={(v) => setFamily(v === "__default__" ? null : v)}
					className="mt-1 max-w-sm"
				/>
			</div>

			<div className="flex flex-wrap items-center gap-3">
				<div className="min-w-56 flex-1">
					<label
						htmlFor="vorynth-font-scale"
						className="font-label text-label-sm uppercase tracking-widest text-on-surface-variant"
					>
						{t("settings.fontSize")}
					</label>
					<input
						id="vorynth-font-scale"
						type="range"
						min={FONT_SCALE_MIN}
						max={FONT_SCALE_MAX}
						step={FONT_SCALE_STEP}
						value={scale}
						onChange={(e) => setScale(Number(e.target.value))}
						aria-valuetext={`${Math.round(scale * 100)}%`}
						className="mt-2 w-full accent-primary"
					/>
					<p className="font-mono text-mono-technical text-on-tertiary-container">
						{Math.round(scale * 100)}%
					</p>
				</div>
				<div className="flex flex-col gap-2">
					<Button
						variant="secondary"
						size="sm"
						icon="file_upload"
						onClick={() => fileInput.current?.click()}
					>
						{t("settings.fontImport")}
					</Button>
					<Button variant="ghost" size="sm" icon="restart_alt" onClick={reset}>
						{t("settings.fontReset")}
					</Button>
				</div>
				<input
					ref={fileInput}
					type="file"
					accept=".woff2,font/woff2"
					className="hidden"
					onChange={(e) => void onImport(e.target.files?.[0])}
				/>
			</div>
			{error ? (
				<p className="font-body text-body-sm text-error">{error}</p>
			) : null}
		</div>
	);
}
