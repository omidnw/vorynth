/**
 * Copyright attribution for media downloads (v1.8.0).
 *
 * The Media page downloads kept media either as the original file or with a
 * copyright credit bar drawn into the image — the blog it came from, the
 * article title, and the source URL. These helpers build that credit and
 * trigger the browser download. The canvas work is isolated here so the page
 * stays readable and tests can mock the rasterization.
 */

export interface AttributionText {
	/** "© 2026 Blog Name — Article title" */
	line1: string;
	/** "Source: https://…" */
	line2: string;
	/** "Downloaded via Vorynth · Jan 1, 2026" */
	line3: string;
}

/**
 * Translatable bits of the credit band. These run in a non-React context
 * (exported images), so the caller threads translated values in via
 * `buildAttributionText`'s `labels` — the defaults are the English fallbacks.
 */
export interface AttributionLabels {
	/** "©" — the copyright mark before the year. */
	copyright: string;
	/** "Source: " — the prefix before the source URL. */
	source: string;
	/** "Downloaded via Vorynth" — the credit line prefix. */
	downloadedVia: string;
}

/** English fallbacks — byte-identical to the strings they replace. */
export const DEFAULT_ATTRIBUTION_LABELS: AttributionLabels = {
	copyright: "©",
	source: "Source: ",
	downloadedVia: "Downloaded via Vorynth",
};

/**
 * Build the three credit lines drawn into a downloaded image. The caller
 * supplies the raw data plus (optionally) translated labels; `noSourceLabel`
 * is shown in place of a missing source name or URL.
 */
export function buildAttributionText({
	sourceName,
	creditTitle,
	sourceUrl,
	noSourceLabel,
	dateLabel,
	labels = {},
}: {
	sourceName: string | null;
	creditTitle: string;
	sourceUrl: string | null;
	noSourceLabel: string;
	dateLabel: string;
	labels?: Partial<AttributionLabels>;
}): AttributionText {
	const L = { ...DEFAULT_ATTRIBUTION_LABELS, ...labels };
	const name = sourceName || noSourceLabel;
	return {
		line1: `${L.copyright} ${new Date().getFullYear()} ${name} — ${creditTitle}`,
		line2: sourceUrl ? `${L.source}${sourceUrl}` : noSourceLabel,
		line3: `${L.downloadedVia} · ${dateLabel}`,
	};
}

/** Filesystem-safe lowercase slug for download filenames. */
export function slugify(text: string): string {
	const out = text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return out || "media";
}

/** File extension for an "original" download, from the URL or MIME type. */
export function extFromUrl(url: string, mime: string | null): string {
	const m = url.match(/\.([a-z0-9]{2,4})(\?|#|$)/i);
	if (m?.[1]) return m[1].toLowerCase();
	if (mime) {
		const sub = mime.split("/")[1]?.split(";")[0];
		if (sub) return sub;
	}
	return "bin";
}

/** Base filename stem for a media item — article title + caption when available. */
export function fileStem(articleTitle: string, caption: string | null): string {
	const base = slugify(articleTitle);
	if (caption) {
		const c = slugify(caption);
		return `${base}-${c.slice(0, 40)}`;
	}
	return base;
}

/**
 * Draw a dark attribution band under the image and export the result as a PNG
 * Blob. Text is scaled with the image width so credit stays readable on both
 * small and very large pictures.
 */
export function drawAttributionBar(
	image: ImageBitmap,
	text: AttributionText,
): Promise<Blob> {
	return new Promise((resolve, reject) => {
		const scale = Math.min(2, Math.max(0.75, image.width / 900));
		const padX = Math.round(18 * scale);
		const lineH = Math.round(22 * scale);
		const smallH = Math.round(18 * scale);
		const barPad = Math.round(14 * scale);
		const barHeight = Math.round(barPad * 2 + lineH + smallH * 2);

		const canvas = document.createElement("canvas");
		canvas.width = image.width;
		canvas.height = image.height + barHeight;
		const ctx = canvas.getContext("2d");
		if (!ctx) {
			reject(new Error("canvas 2d context unavailable"));
			return;
		}

		ctx.drawImage(image, 0, 0);
		ctx.fillStyle = "rgba(0, 0, 0, 0.82)";
		ctx.fillRect(0, image.height, canvas.width, barHeight);
		ctx.fillStyle = "#ffffff";
		ctx.textBaseline = "middle";
		ctx.font = `600 ${Math.round(15 * scale)}px system-ui, -apple-system, "Segoe UI", sans-serif`;
		ctx.fillText(text.line1, padX, image.height + barPad + lineH / 2);
		ctx.font = `${Math.round(12 * scale)}px system-ui, -apple-system, "Segoe UI", sans-serif`;
		ctx.fillText(
			truncate(text.line2, ctx, canvas.width - padX * 2),
			padX,
			image.height + barPad + lineH + smallH / 2,
		);
		ctx.fillText(
			truncate(text.line3, ctx, canvas.width - padX * 2),
			padX,
			image.height + barPad + lineH + smallH + smallH / 2,
		);

		canvas.toBlob((blob) => {
			image.close();
			if (blob) resolve(blob);
			else reject(new Error("image export failed"));
		}, "image/png");
	});
}

/** Fit a line to the credit band width with an ellipsis. */
function truncate(
	text: string,
	ctx: CanvasRenderingContext2D,
	maxWidth: number,
): string {
	if (ctx.measureText(text).width <= maxWidth) return text;
	let t = text;
	while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) {
		t = t.slice(0, -1);
	}
	return `${t}…`;
}

/** Trigger a browser download of a Blob under a filename. */
export function downloadBlob(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
}
