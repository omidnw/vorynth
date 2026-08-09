import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";

/** Same slug rule as the engine's tag normalizer. */
function toSlug(value: string): string {
	return String(value)
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

/** Prefix matches first, then substring — capped at `limit`. */
function suggest(draft: string, vocab: string[], limit = 6): string[] {
	const t = draft.trim().toLowerCase();
	if (!t) return [];
	const prefix: string[] = [];
	const substring: string[] = [];
	for (const v of vocab) {
		if (v.startsWith(t)) prefix.push(v);
		else if (v.includes(t)) substring.push(v);
		if (prefix.length >= limit) break;
	}
	return [...prefix, ...substring].slice(0, limit);
}

/**
 * TagInput (v1.9.0) — chip-based multi-tag entry with live suggestions.
 *
 * Type to see a small suggestion dropdown (top ~6, never the whole list);
 * a **comma** or **Enter** or the trailing **+** button commits the current
 * token as a chip; chips render below with an × to remove; Backspace on an
 * empty field removes the last chip. Values are lowercase slugs ("cloud",
 * "ai") — the vocabulary is a suggestion, never a constraint.
 */
export interface TagInputProps {
	value: string[];
	onChange: (next: string[]) => void;
	/** Full suggestion vocabulary (see features/sources/tag-vocab.ts). */
	suggestions?: string[];
	placeholder?: string;
	"aria-label": string;
	/** Max number of tags (the engine caps at 12). */
	max?: number;
	/** Accessible label for the trailing + button. */
	addButtonLabel?: string;
}

export function TagInput({
	value,
	onChange,
	suggestions = [],
	placeholder,
	"aria-label": ariaLabel,
	max = 12,
	addButtonLabel = "Add",
}: TagInputProps) {
	const [draft, setDraft] = useState("");
	const [open, setOpen] = useState(false);
	const rootRef = useRef<HTMLDivElement>(null);

	const draftSlug = toSlug(draft);
	const matches = useMemo(
		() => (draft.trim() ? suggest(draft, suggestions) : []),
		[draft, suggestions],
	);
	const canAdd =
		draftSlug.length >= 2 &&
		draftSlug.length <= 64 &&
		!value.includes(draftSlug) &&
		value.length < max;

	// Close the dropdown on outside click.
	useEffect(() => {
		if (!open) return;
		const onDown = (e: MouseEvent) => {
			if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
		};
		document.addEventListener("mousedown", onDown);
		return () => document.removeEventListener("mousedown", onDown);
	}, [open]);

	const commit = (raw: string) => {
		const slug = toSlug(raw);
		setDraft("");
		setOpen(false);
		if (!slug || slug.length < 2 || value.includes(slug)) return;
		if (value.length >= max) return;
		onChange([...value, slug]);
	};

	const handleChange = (raw: string) => {
		setDraft(raw);
		setOpen(true);
		// A comma commits the token before it; the rest becomes the next draft
		// ("cloud,ai" → chip cloud, keep typing "ai").
		if (raw.includes(",")) {
			const parts = raw.split(",");
			const head = parts[0];
			if (head?.trim()) commit(head);
			setDraft(parts.slice(1).join(","));
			if (!parts.slice(1).join(",").trim()) setOpen(false);
		}
	};

	const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		switch (e.key) {
			case "Enter":
				e.preventDefault();
				if (canAdd) commit(draft);
				break;
			case "Backspace":
				if (!draft && value.length > 0) onChange(value.slice(0, -1));
				break;
			case "Escape":
				setOpen(false);
				break;
		}
	};

	return (
		<div ref={rootRef} className="relative">
			<div className="relative">
				<Icon
					name="sell"
					className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant"
				/>
				<input
					type="text"
					value={draft}
					onChange={(e) => handleChange(e.target.value)}
					onKeyDown={onKeyDown}
					onFocus={() => setOpen(true)}
					aria-label={ariaLabel}
					placeholder={placeholder}
					className="w-full rounded border border-outline-variant bg-surface-container-low py-3 ps-10 pe-11 font-mono text-mono-technical text-on-surface outline-none transition-colors placeholder:text-on-tertiary-container focus:border-secondary"
				/>
				<button
					type="button"
					onClick={() => commit(draft)}
					disabled={!canAdd}
					aria-label={addButtonLabel}
					title={addButtonLabel}
					className="absolute end-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded text-primary transition-colors hover:bg-surface-container-high disabled:opacity-40"
				>
					<Icon name="add" className="text-[18px]" fill />
				</button>
			</div>

			{/* Live suggestions — top ~6, only while typing. */}
			{open && matches.length > 0 ? (
				<ul className="absolute z-50 mt-1 w-full overflow-hidden rounded border border-outline-variant bg-surface-container-lowest py-1 shadow-lg">
					{matches.map((m) => (
						<li key={m}>
							<button
								type="button"
								onClick={() => commit(m)}
								className="flex w-full items-center gap-2 px-3 py-1.5 text-start font-label text-label-sm text-on-surface transition-colors hover:bg-primary-container hover:text-on-primary-container"
							>
								<Icon
									name="sell"
									className="text-[14px] text-on-surface-variant"
								/>
								{m}
							</button>
						</li>
					))}
				</ul>
			) : null}

			{/* Committed tags — chips with × to remove. */}
			{value.length > 0 ? (
				<div className="mt-2 flex flex-wrap gap-1.5">
					{value.map((tag) => (
						<span
							key={tag}
							className={cn(
								"inline-flex items-center gap-1 rounded-full border border-outline-variant bg-surface-container-low px-2 py-0.5",
								"font-label text-label-sm text-on-surface",
							)}
						>
							{tag}
							<button
								type="button"
								onClick={() => onChange(value.filter((t) => t !== tag))}
								aria-label={`Remove ${tag}`}
								title={`Remove ${tag}`}
								className="text-on-surface-variant transition-colors hover:text-error"
							>
								<Icon name="close" className="text-[14px]" />
							</button>
						</span>
					))}
				</div>
			) : null}
		</div>
	);
}
