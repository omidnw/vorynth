/**
 * Copyright & Attribution Plugin (v1.8.0) — a core, always-on UI plugin that
 * controls how media downloads credit their source.
 *
 * On the Media page, a kept image can be downloaded with a copyright attribution
 * bar drawn into it (the blog it came from, the article title, and the source
 * URL) or as the original file. This plugin's Settings toggle sets the DEFAULT
 * — attribution on or off — while each download still offers both choices.
 *
 * It contributes a Settings section and a docs section, and is locked on like
 * the Icon Pack and the Story Renderer.
 */
import {
	useTranslation,
	usePluginConfig,
	type PluginViewComponent,
} from "@vorynth/plugin-host";
import { VORYNTH_VERSION } from "@vorynth/types";
import type { DocsSection } from "@vorynth/types";

// ── Settings section ─────────────────────────────────────────────────────────

function SettingRow({
	label,
	hint,
	checked,
	onChange,
}: {
	label: string;
	hint: string;
	checked: boolean;
	onChange: (v: boolean) => void;
}) {
	return (
		<div className="flex items-start justify-between gap-4 py-2">
			<div>
				<p className="font-label text-label-md text-on-surface">{label}</p>
				<p className="font-body text-body-sm text-on-surface-variant">{hint}</p>
			</div>
			<button
				type="button"
				role="switch"
				aria-checked={checked}
				aria-label={label}
				onClick={() => onChange(!checked)}
				className={`relative h-6 w-11 flex-none rounded-full transition-colors ${
					checked ? "bg-primary" : "bg-surface-variant"
				}`}
			>
				<span
					className={`absolute top-0.5 h-5 w-5 rounded-full bg-surface-container-lowest transition-all ${
						checked ? "left-[22px]" : "left-0.5"
					}`}
				/>
			</button>
		</div>
	);
}

export function SettingsSection({ pluginId }: { pluginId: string }) {
	const { t } = useTranslation();
	const { config, update } = usePluginConfig(pluginId);
	const includeAttribution = config["includeAttribution"] !== false;

	return (
		<div className="space-y-4">
			<SettingRow
				label={t("mediaCopyright.includeAttributionLabel")}
				hint={t("mediaCopyright.includeAttributionHint")}
				checked={includeAttribution}
				onChange={(v) => void update({ includeAttribution: v })}
			/>
		</div>
	);
}

// ── Docs section ─────────────────────────────────────────────────────────────

const DOCS: DocsSection = {
	id: "media-copyright",
	title: "Copyright & Attribution",
	summary:
		"Media downloads can credit where they came from — the blog, the article, and the source URL.",
	icon: "copyright",
	pageRoute: "/plugin/media-copyright",
	blocks: [
		{
			type: "paragraph",
			text: "The Copyright & Attribution plugin is always on. On the Media page, every kept image can be downloaded either with a copyright attribution bar drawn into it — naming the blog, the article, and the source URL — or as the original file. This plugin's setting picks the default for the Download button; the per-download menu still lets you choose each time.",
		},
		{
			type: "features",
			items: [
				{
					icon: "copyright",
					label: "Attributed downloads",
					text: "A credit bar is drawn into the image: © year, blog, article title, source URL, and the download date.",
				},
				{
					icon: "download",
					label: "Original downloads",
					text: "Download the file exactly as it was stored, with no attribution added.",
				},
				{
					icon: "tune",
					label: "Default in Settings",
					text: "Switch the default between attributed and original here — per-download choices still win.",
				},
			],
		},
		{
			type: "flow",
			title: "A media download with attribution",
			steps: [
				{ icon: "photo_library", label: "Open Media" },
				{ icon: "download", label: "Download an item" },
				{ icon: "privacy_tip", label: "Warning (once)" },
				{ icon: "copyright", label: "Credit is added" },
			],
		},
		{
			type: "bullets",
			items: [
				"Attribution can only be drawn into images. Videos download as the original file.",
				"Before the first download you'll see a one-time warning about the blog's privacy policy — it can be turned back on in Settings.",
				"The plugin is locked on, like the Icon Pack — there is no switch, and its settings live in Settings.",
			],
		},
	],
};

// ── Main view ────────────────────────────────────────────────────────────────

const View: PluginViewComponent = function CopyrightView() {
	const { t } = useTranslation();
	return (
		<div className="space-y-4">
			<div className="rounded-lg border border-outline-variant bg-surface-container-low p-6">
				<p className="font-headline text-headline-sm text-on-surface">
					{t("mediaCopyright.viewTitle")}
				</p>
				<p className="mt-2 font-body text-body-md text-on-surface-variant">
					{t("mediaCopyright.viewIntro", { version: VORYNTH_VERSION })}
				</p>
			</div>
			<div className="rounded-lg border border-outline-variant bg-surface-container-low p-6">
				<p className="font-label text-label-sm uppercase tracking-widest text-on-surface-variant">
					{t("mediaCopyright.viewHow")}
				</p>
				<ul className="mt-2 space-y-2 font-body text-body-md text-on-surface">
					<li>• {t("mediaCopyright.includeAttributionLabel")}</li>
					<li>• {t("mediaCopyright.originalLabel")}</li>
				</ul>
			</div>
		</div>
	);
};

// ── Exports — the host's contribution contract ─────────────────────────────

export default View;
export { DOCS as docsSection };
