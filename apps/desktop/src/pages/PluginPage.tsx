import type { ComponentType } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/ui/Icon";
import { GhostCard } from "@/components/ui/GhostCard";
import { useHasHistory } from "@/lib/router/has-history.js";
import {
	loadedPlugin,
	usePluginContributions,
} from "@/plugins/plugin-contributions.js";
import { usePluginsEnabled } from "@/plugins/plugin-hooks.js";

/**
 * Plugin page (v1.9.0) — hosts a runtime UI plugin's main view at `/plugin/:id`.
 * Renders the bundle's `default` component (when it exports one), or a summary
 * card with its docs link. The plugin's own page header shows name + version.
 */
export function PluginPage() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const { id = "" } = useParams();
	// Back only renders when the user came from somewhere (Plugins list,
	// sidebar entry) — a deep link / restored session has no history, so the
	// button disappears instead of going nowhere. Uses the app's initial
	// location key, not `"default"` (unreliable across trailing slashes).
	const hasHistory = useHasHistory();
	// Subscribe to the contribution store so a plugin that finishes loading
	// after this page mounts re-renders it (the load is async).
	usePluginContributions();
	const enabled = usePluginsEnabled();
	const plugin = loadedPlugin(id);
	const isEnabled = enabled[id] ?? false;

	const View = plugin?.exports.default as
		ComponentType<{ pluginId: string }> | undefined;

	return (
		<section className="mx-auto w-full max-w-max-content-width px-gutter py-12">
			{hasHistory ? (
				<button
					type="button"
					onClick={() => navigate(-1)}
					className="mb-4 inline-flex items-center gap-2 font-label text-label-md uppercase text-on-surface-variant transition-colors hover:text-primary"
				>
					<Icon name="arrow_back" className="text-[18px]" />
					{t("plugins.back")}
				</button>
			) : null}

			{!isEnabled ? (
				<GhostCard>
					<div className="flex items-center gap-3">
						<Icon
							name="extension_off"
							className="text-[24px] text-on-surface-variant"
						/>
						<div>
							<h1 className="font-headline text-headline-sm text-on-surface">
								{t("plugins.disabledTitle", { id })}
							</h1>
							<p className="font-body text-body-md text-on-surface-variant">
								{t("plugins.disabledBody")}
							</p>
						</div>
					</div>
				</GhostCard>
			) : !plugin ? (
				<GhostCard>
					<div className="flex items-center gap-3">
						<Icon
							name="extension_off"
							className="text-[24px] text-on-surface-variant"
						/>
						<div>
							<h1 className="font-headline text-headline-sm text-on-surface">
								{t("plugins.notLoadedTitle", { id })}
							</h1>
							<p className="font-body text-body-md text-on-surface-variant">
								{t("plugins.notLoadedBody")}
							</p>
						</div>
					</div>
				</GhostCard>
			) : (
				<>
					<header className="mb-8">
						<div className="flex flex-wrap items-center gap-3">
							<h1 className="flex items-center gap-3 font-headline text-display-md text-primary dark:text-primary-fixed">
								<Icon name="extension" className="text-[32px]" />
								{plugin.name}
							</h1>
							<span className="font-mono text-mono-technical text-on-surface-variant">
								{t("plugins.version", { version: plugin.version })}
							</span>
							{plugin.exports.docsSection ? (
								<Link
									to={`/docs#${plugin.exports.docsSection.id}`}
									className="inline-flex items-center gap-1 font-label text-label-sm text-secondary transition-colors hover:text-primary hover:underline"
								>
									<Icon name="school" className="text-[14px]" />
									{t("plugins.readDocs")}
								</Link>
							) : null}
						</div>
					</header>

					{View ? (
						<View pluginId={plugin.id} />
					) : (
						<GhostCard>
							<p className="font-body text-body-md text-on-surface-variant">
								{t("plugins.noView")}
							</p>
						</GhostCard>
					)}
				</>
			)}
		</section>
	);
}
