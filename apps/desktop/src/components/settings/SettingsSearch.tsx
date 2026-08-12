import { useTranslation } from "react-i18next";
import { Icon } from "@/components/ui/Icon";

/**
 * SettingsSearch — the category filter box used at the top of the Settings
 * and Profile pages.
 *
 * A labelled search input (placeholder + aria-label from
 * `settings.searchPlaceholder`) styled like the app's inputs, with a small
 * hint line underneath explaining that unmatched sections are dimmed.
 *
 * Typing filters + dims live; the JUMP to the first match happens only on
 * Enter or the trailing search button (v1.8.0) — never mid-keystroke.
 */
export interface SettingsSearchProps {
	value: string;
	onChange: (value: string) => void;
	/** Commits the query: scrolls to the first match (or the cross-page hint). */
	onSearch?: () => void;
}

export function SettingsSearch({
	value,
	onChange,
	onSearch,
}: SettingsSearchProps) {
	const { t } = useTranslation();
	return (
		<div>
			<div className="relative">
				<Icon
					name="search"
					className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant"
				/>
				<input
					type="search"
					value={value}
					onChange={(e) => onChange(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter") {
							e.preventDefault();
							onSearch?.();
						}
					}}
					aria-label={t("settings.searchPlaceholder")}
					placeholder={t("settings.searchPlaceholder")}
					// `block` keeps the wrapper at the input's real height so the
					// leading icon's top-1/2 centers on the field, not the line box.
					className="block w-full rounded border border-outline-variant bg-surface-container-low py-3 ps-10 pe-12 font-mono text-mono-technical text-on-surface outline-none transition-colors placeholder:text-on-tertiary-container focus:border-secondary"
				/>
				{onSearch ? (
					<button
						type="button"
						onClick={onSearch}
						aria-label={t("settings.searchButton")}
						title={t("settings.searchButton")}
						className="absolute end-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded text-primary transition-colors hover:bg-surface-container-high"
					>
						<Icon name="search" className="text-[18px]" fill />
					</button>
				) : null}
			</div>
			<p className="mt-2 font-body text-body-sm text-on-surface-variant">
				{t("settings.searchHint")}
			</p>
		</div>
	);
}
