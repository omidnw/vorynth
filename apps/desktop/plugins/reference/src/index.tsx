/**
 * Reference Plugin (v1.8.0) — the template every runtime UI plugin is modeled
 * on. It demonstrates all four contribution types the host supports:
 *
 *   • theme        — "Solar Flare", a warm light+dark palette
 *   • settings     — a Settings section with persisted toggles
 *   • docsSection  — its own guide on the in-app Documentation page
 *   • navItems     — a sidebar entry opening its main view
 *   • default      — the main view rendered at /plugin/reference
 *
 * Everything a plugin needs comes from `@vorynth/plugin-host` (the SDK, aliased
 * by the bundle builder to the host bridge) — never from the app internals.
 */
import {
	useTranslation,
	usePluginConfig,
	type PluginViewComponent,
} from "@vorynth/plugin-host";
import { VORYNTH_VERSION } from "@vorynth/types";
import type { DocsSection, PluginTheme } from "@vorynth/types";

// ── Theme: "Solar Flare" ────────────────────────────────────────────────────
// Token maps are `--color-*` → "r g b" triplets (the same format as theme.css).
// The host injects them scoped to :root[data-theme="solar-flare"] (+ .dark).

const SOLAR_THEME: PluginTheme = {
	id: "solar-flare",
	name: "Solar Flare",
	// The theme's identity icon — shown in the shell toggle + Settings picker
	// instead of the plain sun/moon while this theme is active.
	icon: "flare",
	// Canvas background (raw CSS) — the escape hatch for gradients/images that
	// the "r g b" color-token pipeline can't carry.
	background: {
		light:
			"linear-gradient(180deg, rgb(255 243 233 / 0.6), rgb(255 235 220 / 0.25) 40%, rgb(252 227 208 / 0.4))",
		dark: "linear-gradient(180deg, rgb(48 36 27 / 0.55), rgb(28 19 12 / 0.4) 40%, rgb(59 46 36 / 0.45))",
	},
	light: {
		"--color-surface": "255 249 243",
		"--color-surface-container": "255 243 233",
		"--color-surface-container-high": "255 235 220",
		"--color-surface-container-highest": "252 227 208",
		"--color-surface-container-lowest": "255 255 255",
		"--color-background": "255 249 243",
		"--color-on-surface": "46 32 22",
		"--color-on-surface-variant": "104 82 62",
		"--color-primary": "196 84 20",
		"--color-primary-container": "255 219 191",
		"--color-on-primary-container": "68 32 4",
		"--color-secondary": "137 93 57",
		"--color-secondary-container": "255 219 196",
		"--color-on-secondary-container": "73 38 10",
		"--color-tertiary": "117 68 96",
		"--color-tertiary-container": "255 216 235",
		"--color-on-tertiary-container": "60 12 43",
		"--color-outline": "128 102 86",
		"--color-outline-variant": "208 179 159",
		"--color-gold": "196 124 30",
	},
	dark: {
		"--color-surface": "28 19 12",
		"--color-surface-container": "37 27 19",
		"--color-surface-container-high": "48 36 27",
		"--color-surface-container-highest": "59 46 36",
		"--color-surface-container-lowest": "22 14 8",
		"--color-background": "28 19 12",
		"--color-on-surface": "241 224 207",
		"--color-on-surface-variant": "200 178 158",
		"--color-primary": "255 184 135",
		"--color-primary-container": "146 63 8",
		"--color-on-primary-container": "255 219 191",
		"--color-secondary": "229 187 150",
		"--color-secondary-container": "112 69 37",
		"--color-on-secondary-container": "255 219 196",
		"--color-tertiary": "231 178 210",
		"--color-tertiary-container": "92 43 70",
		"--color-on-tertiary-container": "255 216 235",
		"--color-outline": "160 133 115",
		"--color-outline-variant": "89 65 51",
		"--color-gold": "242 186 84",
	},
};

// ── Settings section: persisted toggles ─────────────────────────────────────

/**
 * SettingsSection — rendered inside the Settings page. Each toggle persists via
 * `usePluginConfig` into the plugin's `plugins.configuration` JSON (the engine
 * PATCHes it; no app code needed).
 */
export function SettingsSection({ pluginId }: { pluginId: string }) {
	const { t } = useTranslation();
	const { config, update } = usePluginConfig(pluginId);

	const greeting = config["greeting"] !== false;
	const compact = config["compact"] === true;

	return (
		<div className="space-y-4">
			<SettingRow
				label={t("reference.greetingLabel")}
				hint={t("reference.greetingHint")}
				checked={greeting}
				onChange={(v) => void update({ greeting: v })}
			/>
			<SettingRow
				label={t("reference.compactLabel")}
				hint={t("reference.compactHint")}
				checked={compact}
				onChange={(v) => void update({ compact: v })}
			/>
		</div>
	);
}

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

// ── Docs section: the plugin's own guide ────────────────────────────────────

const DOCS: DocsSection = {
	id: "reference",
	title: "Reference Plugin",
	summary:
		"What a runtime plugin can contribute — and the template for building your own.",
	icon: "extension",
	pageRoute: "/plugin/reference",
	blocks: [
		{
			type: "paragraph",
			text: "The Reference Plugin exists to show every contribution a runtime plugin can make. It ships disabled — you switch it on in Plugins — and stays in step with the app version, so it doubles as living documentation: copy its source to build your own plugin.",
		},
		{
			type: "features",
			items: [
				{
					icon: "palette",
					label: "Theme",
					text: "Solar Flare — a warm light+dark palette selectable in Settings → Appearance.",
				},
				{
					icon: "tune",
					label: "Settings section",
					text: "Two persisted toggles that live in the plugin's configuration.",
				},
				{
					icon: "extension",
					label: "Sidebar entry",
					text: "This plugin's own page at /plugin/reference.",
				},
				{
					icon: "school",
					label: "Docs section",
					text: "This guide — reachable at /docs#reference.",
				},
			],
		},
		{
			type: "flow",
			title: "A plugin contributes by exporting",
			steps: [
				{ icon: "extension", label: "default view" },
				{ icon: "menu", label: "navItems" },
				{ icon: "tune", label: "SettingsSection" },
				{ icon: "school", label: "docsSection" },
				{ icon: "palette", label: "themes" },
			],
		},
		{
			type: "bullets",
			items: [
				"Everything a plugin needs comes from @vorynth/plugin-host — React, i18n, the engine API, and plugin configuration. It never imports app internals.",
				"Plugins are bundled at build time and loaded at runtime, so toggling one off pauses its contributions without a restart.",
				"The engine owns enable state and persisted configuration; the desktop host loads the bundle and renders its contributions.",
			],
		},
	],
};

// ── Main view (default export) ──────────────────────────────────────────────

const View: PluginViewComponent = function ReferenceView({ pluginId }) {
	const { t } = useTranslation();
	const { config } = usePluginConfig(pluginId);
	const greeting = config["greeting"] !== false;

	return (
		<div className="space-y-4">
			<div className="rounded-lg border border-outline-variant bg-surface-container-low p-6">
				<p className="font-headline text-headline-sm text-on-surface">
					{greeting ? t("reference.greeting") : t("reference.greetingOff")}
				</p>
				<p className="mt-2 font-body text-body-md text-on-surface-variant">
					{t("reference.intro", { version: VORYNTH_VERSION })}
				</p>
			</div>
			<div className="rounded-lg border border-outline-variant bg-surface-container-low p-6">
				<p className="font-label text-label-sm uppercase tracking-widest text-on-surface-variant">
					{t("reference.contributions")}
				</p>
				<ul className="mt-2 space-y-2 font-body text-body-md text-on-surface">
					<li>• {t("reference.theme")}</li>
					<li>• {t("reference.settings")}</li>
					<li>• {t("reference.docs")}</li>
					<li>• {t("reference.sidebar")}</li>
				</ul>
			</div>
		</div>
	);
};

// ── Exports — the host's contribution contract ─────────────────────────────

export default View;
export { DOCS as docsSection };
export const navItems = [
	{ id: "reference", label: "Reference", icon: "extension" },
];
export const themes = [SOLAR_THEME];
