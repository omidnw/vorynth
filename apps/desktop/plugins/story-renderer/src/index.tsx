/**
 * Story Renderer Plugin (v1.8.0) — a core, always-on UI plugin that turns any
 * story into a portable artifact:
 *
 *   • Markdown        — a `.md` file (title, metadata, body)
 *   • Themed HTML     — a single self-contained `.html` document with a clean
 *                       editorial theme (system fonts, no network)
 *   • Screenshot PNG  — the themed story rasterized with html-to-image into a
 *                       ready-to-share image
 *
 * It contributes a `StoryExports` panel to the Article reader (opened by the
 * reader's Export button), a Settings section (metadata + translated-text
 * toggles), a docs section, and its own page at /plugin/story-renderer. The
 * plugin is locked on — the engine refuses to disable it, exactly like the
 * Icon Pack.
 *
 * Story bodies are usually stored as plain text, but some sources publish raw
 * HTML (`content:encoded`, API `contentField`s) — so the renderers normalize
 * any HTML body to clean prose BEFORE building (mirroring the reader's
 * plain-text path). They never re-parse source markup into the output, and the
 * only link an export carries is the story's own `content.url`.
 */
import {
	useTranslation,
	usePluginConfig,
	useState,
	type PluginViewComponent,
} from "@vorynth/plugin-host";
import { VORYNTH_VERSION } from "@vorynth/types";
import type { ExportableContent, DocsSection } from "@vorynth/types";
import { toPng } from "html-to-image";

const PLUGIN_ID = "story-renderer";

// ── Text building blocks ─────────────────────────────────────────────────────

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

/**
 * Content tags worth detecting so rich bodies take the HTML path — the same
 * allowlist the reader's RichContent uses (kept in sync deliberately).
 */
const KNOWN_TAGS =
	"(?:p|div|br|strong|b|em|i|u|s|a|ul|ol|li|h[1-6]|blockquote|code|pre|span|hr|" +
	"table|thead|tbody|tr|th|td|figure|figcaption|mark|small|sub|sup|del|ins|q|" +
	"cite|abbr|time|dl|dt|dd|img|video|audio|iframe|script|style|section|article|header|footer|nav|aside|main)";
const HTML_RE = new RegExp(`<\\/?(?:${KNOWN_TAGS})[\\s>]`, "i");

function isHtml(text: string): boolean {
	return HTML_RE.test(text);
}

/**
 * Turn a raw HTML body into clean prose (v1.8.0). Block boundaries become
 * paragraph breaks so `<p>…</p>` / `<h2>` / `<li>` structure survives into the
 * exported Markdown/HTML as readable paragraphs instead of raw tags or one
 * mashed sentence. Uses the DOM (browser + jsdom) — this plugin only renders
 * client-side, so DOMParser is always available.
 */
function htmlToReadableText(html: string): string {
	const doc = new DOMParser().parseFromString(html, "text/html");
	const container = doc.body;
	for (const el of Array.from(
		container.querySelectorAll(
			"p, div, h1, h2, h3, h4, h5, h6, li, blockquote, tr, section, article, header, footer",
		),
	)) {
		el.append(document.createTextNode("\n\n"));
	}
	const text = container.textContent ?? "";
	return text
		.replace(/[ \t]+/g, " ")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

/** Split stored text into paragraphs (double newlines), else one paragraph. */
function paragraphs(text: string): string[] {
	const parts = text
		.split(/\n{2,}/)
		.map((p) => p.trim())
		.filter(Boolean);
	return parts.length > 0 ? parts : [text.trim() || ""];
}

/** Keep a plain-text paragraph from being parsed as Markdown structure. */
function escapeMarkdownParagraph(text: string): string {
	return text.replace(/^([#>+\-*]|\d+\.)\s+/gm, "\\$1 ");
}

function slugify(text: string): string {
	const out = text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return out || "story";
}

function formatDate(value: Date | string | null | undefined): string {
	if (!value) return "";
	const d = new Date(value);
	if (Number.isNaN(d.getTime())) return "";
	return d.toLocaleDateString(undefined, {
		day: "numeric",
		month: "long",
		year: "numeric",
	});
}

interface RenderOpts {
	includeMetadata: boolean;
	preferTranslated: boolean;
}

/** The text to export — the translation when preferred, else the original.
 *  Raw HTML bodies (some feeds/API sources) are normalized to clean prose
 *  first, so no source tag ever leaks into the export. */
function bodyText(content: ExportableContent, opts: RenderOpts): string {
	const raw =
		opts.preferTranslated && content.translatedBody
			? content.translatedBody
			: content.body;
	return isHtml(raw) ? htmlToReadableText(raw) : raw;
}

function metaLine(content: ExportableContent): string[] {
	const parts: string[] = [];
	if (content.source) parts.push(content.source);
	if (content.author) parts.push(content.author);
	if (content.publishedAt) parts.push(formatDate(content.publishedAt));
	return parts;
}

// ── Markdown renderer ────────────────────────────────────────────────────────

function buildMarkdown(content: ExportableContent, opts: RenderOpts): string {
	const lines: string[] = [];
	lines.push(`# ${content.title}`);
	lines.push("");

	if (opts.includeMetadata) {
		const meta = metaLine(content);
		if (meta.length > 0) lines.push(`*${meta.join(" · ")}*`);
		if (content.url) lines.push(`Source: ${content.url}`);
		lines.push("");
	}

	if (content.kind === "insight" && content.insight) {
		// An insight export keeps the reader's labeled sections (v1.8.0) —
		// "Why it matters / Impact / Recommended Action" — instead of dumping
		// them as anonymous paragraphs, so it never looks like an article.
		const { significance, impact, recommendedAction } = content.insight;
		for (const [heading, text] of [
			["Why it matters", significance],
			["Impact", impact],
			["Recommended Action", recommendedAction],
		] as const) {
			if (!text) continue;
			lines.push(`## ${heading}`);
			lines.push("");
			lines.push(escapeMarkdownParagraph(text));
			lines.push("");
		}
		// Bilingual export (v1.8.0): when the analysis exists in the story's
		// source language too, render that version beneath a clear divider.
		if (content.insightOriginal) {
			const original = content.insightOriginal;
			lines.push("---");
			lines.push("");
			lines.push("## In the story's original language");
			lines.push("");
			for (const [heading, text] of [
				["Why it matters", original.significance],
				["Impact", original.impact],
				["Recommended Action", original.recommendedAction],
			] as const) {
				if (!text) continue;
				lines.push(`### ${heading}`);
				lines.push("");
				lines.push(escapeMarkdownParagraph(text));
				lines.push("");
			}
		}
	} else {
		for (const p of paragraphs(bodyText(content, opts))) {
			lines.push(escapeMarkdownParagraph(p));
			lines.push("");
		}
	}

	lines.push("---");
	lines.push("");
	lines.push(`*Exported with Vorynth ${VORYNTH_VERSION}.*`);
	return lines.join("\n").trimEnd() + "\n";
}

// ── Themed HTML renderer ─────────────────────────────────────────────────────

/**
 * The story's HTML (`<style>` + `<article>`) — shared by the full document
 * export and the screenshot, so a PNG always shows exactly the exported page.
 */
function buildStoryHtml(content: ExportableContent, opts: RenderOpts): string {
	const meta = metaLine(content);
	const footerNote = `Exported with Vorynth ${VORYNTH_VERSION}`;

	// v1.8.0 — an insight export renders its labeled analysis sections ("Why it
	// matters" / "Impact" / "Recommended Action") the way the reader shows them;
	// an article keeps the plain prose paragraphs. A bilingual insight also
	// carries its source-language version as a second block.
	let bodyHtml: string;
	if (content.kind === "insight" && content.insight) {
		const { significance, impact, recommendedAction } = content.insight;
		const section = (label: string, text: string, action = false) =>
			text
				? `      <section class="${action ? "insight-action" : "insight-block"}">
        <h2 class="section-label">${escapeHtml(label)}</h2>
        ${paragraphs(text)
					.map((p) => `        <p>${escapeHtml(p)}</p>`)
					.join("\n")}
      </section>`
				: "";
		const main = [
			section("Why it matters", significance),
			section("Impact", impact),
			section("Recommended Action", recommendedAction, true),
		]
			.filter(Boolean)
			.join("\n");
		const original = content.insightOriginal
			? [
					`      <hr class="insight-divider" />`,
					`      <section class="insight-original">`,
					`        <h2 class="original-title">In the story's original language</h2>`,
					section("Why it matters", content.insightOriginal.significance),
					section("Impact", content.insightOriginal.impact),
					section(
						"Recommended Action",
						content.insightOriginal.recommendedAction,
						true,
					),
					`      </section>`,
				]
					.filter(Boolean)
					.join("\n")
			: "";
		bodyHtml = [main, original].filter(Boolean).join("\n");
	} else {
		bodyHtml = paragraphs(bodyText(content, opts))
			.map((p) => `      <p>${escapeHtml(p)}</p>`)
			.join("\n");
	}

	const metaHtml = [
		meta.length > 0
			? `<span class="meta">${escapeHtml(meta.join(" · "))}</span>`
			: "",
		content.url
			? `<span class="meta"><a href="${escapeHtml(content.url)}">${escapeHtml(content.url)}</a></span>`
			: "",
	]
		.filter(Boolean)
		.join("\n            ");

	return `    <style>
      /* Vorynth app palette (desktop/src/styles/theme.css) — the export wears
         the app's own theme, light + dark. */
      :root {
        color-scheme: light dark;
        --bg: #F8FAFA;
        --card: #FFFFFF;
        --fg: #191C1D;
        --muted: #424846;
        --accent: #1A2E2A;
        --accent-soft: #CFE4DF;
        --on-accent-soft: #536662;
        --rule: #C2C8C5;
        --gold: #C5A267;
      }
      @media (prefers-color-scheme: dark) {
        :root {
          --bg: #0E1513;
          --card: #161D1B;
          --fg: #DDE4E0;
          --muted: #C2C8C5;
          --accent: #D0E7E1;
          --accent-soft: #3B4A40;
          --on-accent-soft: #A9B9AC;
          --rule: #2F3634;
          --gold: #C5A267;
        }
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: var(--bg);
        color: var(--fg);
        font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
        line-height: 1.7;
        -webkit-font-smoothing: antialiased;
      }
      .vorynth-story {
        max-width: 720px;
        margin: 0 auto;
        padding: 56px 32px 48px;
      }
      .kicker {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--accent);
        margin: 0 0 12px;
      }
      h1 {
        font-size: 34px;
        line-height: 1.18;
        letter-spacing: -0.01em;
        margin: 0 0 20px;
        font-weight: 700;
      }
      .meta-row {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding-bottom: 24px;
        margin-bottom: 28px;
        border-bottom: 1px solid var(--rule);
      }
      .meta {
        font-size: 13px;
        color: var(--muted);
      }
      .meta a { color: var(--accent); text-decoration: none; }
      .meta a:hover { text-decoration: underline; }
      .body p {
        margin: 0 0 22px;
        font-size: 18px;
      }
      .insight-block { margin: 0 0 28px; }
      .section-label {
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--accent);
        margin: 0 0 10px;
      }
      .insight-action {
        margin-top: 8px;
        padding: 24px 26px;
        border-radius: 12px;
        background: var(--accent-soft);
        color: var(--on-accent-soft);
      }
      .insight-action .section-label { color: inherit; }
      .insight-action p { font-style: italic; }
      .insight-divider {
        margin: 36px 0 28px;
        border: 0;
        border-top: 1px solid var(--rule);
      }
      .original-title {
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--gold);
        margin: 0 0 18px;
      }
      .footer {
        margin-top: 36px;
        padding-top: 18px;
        border-top: 1px solid var(--rule);
        font-size: 12px;
        color: var(--muted);
      }
    </style>
    <article class="vorynth-story">
      <header>
        ${opts.includeMetadata && content.source ? `<p class="kicker">${escapeHtml(content.source)}</p>` : ""}
        <h1>${escapeHtml(content.title)}</h1>
        ${opts.includeMetadata ? `<div class="meta-row">${metaHtml}</div>` : ""}
      </header>
      <div class="body">
${bodyHtml}
      </div>
      <footer class="footer">${escapeHtml(footerNote)}</footer>
    </article>`;
}

function buildFullHtml(content: ExportableContent, opts: RenderOpts): string {
	const title = content.title;
	return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
${buildStoryHtml(content, opts)}
  </head>
  <body>
  </body>
</html>
`;
}

// ── Screenshot renderer ──────────────────────────────────────────────────────

/** Render the themed story offscreen and rasterize it to a PNG data URL. */
async function capturePng(
	content: ExportableContent,
	opts: RenderOpts,
): Promise<string> {
	const holder = document.createElement("div");
	holder.style.position = "fixed";
	holder.style.left = "-10000px";
	holder.style.top = "0";
	holder.style.width = "900px";
	holder.innerHTML = buildStoryHtml(content, opts);
	document.body.appendChild(holder);
	try {
		// Wait a frame so the styles are applied before rasterizing.
		await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
		return await toPng(holder, { pixelRatio: 2 });
	} finally {
		holder.remove();
	}
}

function dataUrlToBlob(dataUrl: string): Blob {
	const [meta = "", b64 = ""] = dataUrl.split(",");
	const bin = atob(b64);
	const bytes = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
	const mime = meta.match(/^data:([^;]+)/)?.[1] ?? "image/png";
	return new Blob([bytes], { type: mime });
}

function downloadBlob(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
}

function downloadText(text: string, filename: string, mime: string): void {
	downloadBlob(new Blob([text], { type: mime }), filename);
}

// ── StoryExports — the panel rendered in the reader's Export dialog ──────────

function StoryExports({
	content,
	onClose,
}: {
	content: ExportableContent;
	onClose: () => void;
}) {
	const { t } = useTranslation();
	const { config } = usePluginConfig(PLUGIN_ID);
	const opts: RenderOpts = {
		includeMetadata: config["includeMetadata"] !== false,
		preferTranslated: config["preferTranslated"] !== false,
	};
	const [busy, setBusy] = useState<string | null>(null);
	const [failed, setFailed] = useState(false);

	async function run(kind: "markdown" | "html" | "png") {
		if (busy) return;
		setBusy(kind);
		setFailed(false);
		try {
			const base = slugify(content.title);
			if (kind === "markdown") {
				downloadText(
					buildMarkdown(content, opts),
					`${base}.md`,
					"text/markdown;charset=utf-8",
				);
			} else if (kind === "html") {
				downloadText(
					buildFullHtml(content, opts),
					`${base}.html`,
					"text/html;charset=utf-8",
				);
			} else {
				const dataUrl = await capturePng(content, opts);
				downloadBlob(dataUrlToBlob(dataUrl), `${base}.png`);
			}
		} catch (err) {
			console.error("Story Renderer export failed", err);
			setFailed(true);
		} finally {
			setBusy(null);
		}
	}

	return (
		<div className="space-y-3">
			<p className="font-label text-label-sm uppercase tracking-widest text-on-surface-variant">
				{t("storyRenderer.exportTitle")}
			</p>
			<ExportRow
				icon="description"
				label={t("storyRenderer.markdown")}
				hint={t("storyRenderer.markdownHint")}
				busy={busy === "markdown"}
				onClick={() => void run("markdown")}
			/>
			<ExportRow
				icon="code"
				label={t("storyRenderer.html")}
				hint={t("storyRenderer.htmlHint")}
				busy={busy === "html"}
				onClick={() => void run("html")}
			/>
			<ExportRow
				icon="image"
				label={t("storyRenderer.png")}
				hint={t("storyRenderer.pngHint")}
				busy={busy === "png"}
				onClick={() => void run("png")}
			/>
			{failed ? (
				<p className="font-body text-body-sm text-error">
					{t("storyRenderer.exportFailed")}
				</p>
			) : null}
			<div className="flex justify-end">
				<button
					type="button"
					onClick={onClose}
					className="rounded border border-outline-variant px-3 py-1.5 font-label text-label-md text-on-surface-variant transition-colors hover:border-secondary hover:text-secondary"
				>
					{t("storyRenderer.close")}
				</button>
			</div>
		</div>
	);
}

function ExportRow({
	icon,
	label,
	hint,
	busy,
	onClick,
}: {
	icon: string;
	label: string;
	hint: string;
	busy: boolean;
	onClick: () => void;
}) {
	const { t } = useTranslation();
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={busy}
			className="flex w-full items-center gap-4 rounded-lg border border-outline-variant bg-surface-container-low p-4 text-left transition-colors hover:border-secondary hover:bg-surface-container-high disabled:opacity-60"
		>
			<span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-primary-container text-on-primary-container">
				<span
					className="material-symbols-outlined text-[22px]"
					aria-hidden="true"
				>
					{icon}
				</span>
			</span>
			<span className="min-w-0 flex-1">
				<span className="block font-label text-label-md text-on-surface">
					{label}
				</span>
				<span className="block font-body text-body-sm text-on-surface-variant">
					{hint}
				</span>
			</span>
			<span className="flex-none font-label text-label-md text-secondary">
				{busy ? t("storyRenderer.busy") : label}
			</span>
		</button>
	);
}

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
	const includeMetadata = config["includeMetadata"] !== false;
	const preferTranslated = config["preferTranslated"] !== false;

	return (
		<div className="space-y-4">
			<SettingRow
				label={t("storyRenderer.includeMetadataLabel")}
				hint={t("storyRenderer.includeMetadataHint")}
				checked={includeMetadata}
				onChange={(v) => void update({ includeMetadata: v })}
			/>
			<SettingRow
				label={t("storyRenderer.preferTranslatedLabel")}
				hint={t("storyRenderer.preferTranslatedHint")}
				checked={preferTranslated}
				onChange={(v) => void update({ preferTranslated: v })}
			/>
		</div>
	);
}

// ── Docs section ─────────────────────────────────────────────────────────────

const DOCS: DocsSection = {
	id: "story-renderer",
	title: "Story Renderer",
	summary:
		"Turn any Vorynth content — a story, insight, answer, or briefing — into Markdown, a themed HTML page, or a ready-to-share screenshot.",
	icon: "description",
	pageRoute: "/plugin/story-renderer",
	blocks: [
		{
			type: "paragraph",
			text: "The Story Renderer is a core plugin that's always on. Wherever Vorynth offers an Export button — the article reader, an AI insight, an Ask-AI answer, a saved history entry, or a period briefing — it opens this panel with three ways to keep the content: Markdown, a single self-contained HTML page with a clean editorial theme, or a screenshot rendered from that same themed page. Everything is generated locally — no network, no external services.",
		},
		{
			type: "features",
			items: [
				{
					icon: "description",
					label: "Markdown",
					text: "A .md file with the story title, source metadata, and the full body text.",
				},
				{
					icon: "code",
					label: "Themed HTML",
					text: "One .html file with the story styled in a light-and-dark editorial theme — opens anywhere, works offline.",
				},
				{
					icon: "image",
					label: "Screenshot (PNG)",
					text: "The themed story rendered to a ready-to-share PNG image, at double resolution.",
				},
				{
					icon: "tune",
					label: "Settings",
					text: "Include story metadata and prefer the translated text when one exists — both toggled in Settings.",
				},
			],
		},
		{
			type: "flow",
			title: "Exporting",
			steps: [
				{ icon: "file_download", label: "Press Export" },
				{ icon: "description", label: "Pick a format" },
				{ icon: "download", label: "File downloads" },
			],
		},
		{
			type: "bullets",
			items: [
				"Exports are clean prose — any raw HTML body is normalized to readable text first, so no source tags ever show up, and the only link is the story's own URL.",
				"The HTML page uses system fonts and a light/dark theme that follows your device.",
				"The plugin is locked on, like the Icon Pack — there is no switch, and its settings live in Settings.",
			],
		},
	],
};

// ── Main view ────────────────────────────────────────────────────────────────

const View: PluginViewComponent = function StoryRendererView() {
	const { t } = useTranslation();
	return (
		<div className="space-y-4">
			<div className="rounded-lg border border-outline-variant bg-surface-container-low p-6">
				<p className="font-headline text-headline-sm text-on-surface">
					{t("storyRenderer.viewTitle")}
				</p>
				<p className="mt-2 font-body text-body-md text-on-surface-variant">
					{t("storyRenderer.viewIntro", { version: VORYNTH_VERSION })}
				</p>
			</div>
			<div className="rounded-lg border border-outline-variant bg-surface-container-low p-6">
				<p className="font-label text-label-sm uppercase tracking-widest text-on-surface-variant">
					{t("storyRenderer.viewFormats")}
				</p>
				<ul className="mt-2 space-y-2 font-body text-body-md text-on-surface">
					<li>• {t("storyRenderer.markdown")}</li>
					<li>• {t("storyRenderer.html")}</li>
					<li>• {t("storyRenderer.png")}</li>
				</ul>
			</div>
		</div>
	);
};

// ── Exports — the host's contribution contract ─────────────────────────────

export default View;
export { DOCS as docsSection, StoryExports };
// The pure render builders are exported for unit testing (they are DOM-free
// except htmlToReadableText, which needs a document — provided by jsdom).
export { buildMarkdown, buildStoryHtml, buildFullHtml };
