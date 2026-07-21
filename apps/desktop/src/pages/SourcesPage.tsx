import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
	CreateSourceInput,
	Source,
	SourceCategory,
	SourceType,
} from "@vorynth/types";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { DomainTag } from "@/components/ui/Badge";
import { GhostCard } from "@/components/ui/GhostCard";
import {
	createSource,
	deleteSource,
	fetchSources,
	toggleSource,
	updateSource,
} from "@/features/sources/sources-api.js";

const CATEGORIES: SourceCategory[] = [
	"ai",
	"software-engineering",
	"programming-languages",
	"web-development",
	"backend",
	"devops",
	"cloud",
	"security",
	"open-source",
	"other",
];

const TYPES: SourceType[] = ["rss", "api", "html", "sitemap"];

/**
 * Source management page (examples/source-management.html).
 *
 * List configured sources, enable/disable, add new (RSS/API/HTML/Sitemap),
 * remove. Per project-details.md §29: new sources are configuration, not code.
 */
export function SourcesPage() {
	const queryClient = useQueryClient();
	const { data: sources = [], isLoading } = useQuery({
		queryKey: ["sources"],
		queryFn: fetchSources,
	});
	const [showAdd, setShowAdd] = useState(false);

	const invalidate = () =>
		queryClient.invalidateQueries({ queryKey: ["sources"] });
	const toggle = useMutation({
		mutationFn: (s: Source) => toggleSource(s.id, !s.enabled),
		onSuccess: invalidate,
	});
	const setWindow = useMutation({
		mutationFn: ({ id, days }: { id: string; days: number }) =>
			updateSource(id, { fetchWindowDays: days }),
		onSuccess: invalidate,
	});
	const remove = useMutation({
		mutationFn: (id: string) => deleteSource(id),
		onSuccess: invalidate,
	});

	const enabledCount = sources.filter((s) => s.enabled).length;

	return (
		<section className="mx-auto w-full max-w-max-content-width px-gutter py-12">
			<header className="mb-10 flex flex-wrap items-end justify-between gap-4">
				<div>
					<h2 className="mb-2 font-headline text-headline-lg text-primary dark:text-primary-fixed">
						Sources
					</h2>
					<div className="flex items-center gap-4 font-label text-label-md text-on-tertiary-container">
						<span>{sources.length} total</span>
						<span className="h-1 w-1 rounded-full bg-outline-variant" />
						<span className="text-secondary">{enabledCount} enabled</span>
					</div>
				</div>
				<Button icon="add" onClick={() => setShowAdd((v) => !v)}>
					Add Source
				</Button>
			</header>

			{showAdd ? <AddSourceForm onDone={() => setShowAdd(false)} /> : null}

			{isLoading ? (
				<p className="font-body text-body-md text-on-surface-variant">
					Loading sources…
				</p>
			) : (
				<div className="space-y-4">
					{sources.map((s) => (
						<GhostCard key={s.id} className="flex items-center gap-4 py-4">
							<div
								className={`flex h-10 w-10 items-center justify-center rounded bg-surface-container-high ${s.enabled ? "" : "opacity-40"}`}
							>
								<Icon name={typeIcon(s.type)} className="text-primary" />
							</div>
							<div className="flex-1">
								<div className="flex items-center gap-3">
									<h3
										className={`font-label text-label-md text-on-surface ${s.enabled ? "" : "line-through opacity-60"}`}
									>
										{s.name}
									</h3>
									<DomainTag>{s.category}</DomainTag>
								</div>
								<p className="mt-1 font-mono text-mono-technical text-on-tertiary-container">
									{s.url}
								</p>
								{/* Per-source fetch window (default 7 days). */}
								<div className="mt-2 flex items-center gap-2">
									<label
										htmlFor={`window-${s.id}`}
										className="font-label text-label-sm uppercase tracking-wide text-on-surface-variant"
									>
										Fetch window
									</label>
									<select
										id={`window-${s.id}`}
										value={String(s.fetchWindowDays ?? 7)}
										onChange={(e) =>
											setWindow.mutate({
												id: s.id,
												days: Number(e.target.value),
											})
										}
										className="border border-outline-variant bg-transparent px-2 py-1 font-mono text-mono-technical outline-none focus:border-secondary"
									>
										<option
											value="1"
											className="bg-surface-container-lowest text-on-surface"
										>
											1 day
										</option>
										<option
											value="7"
											className="bg-surface-container-lowest text-on-surface"
										>
											7 days (default)
										</option>
										<option
											value="14"
											className="bg-surface-container-lowest text-on-surface"
										>
											14 days
										</option>
										<option
											value="30"
											className="bg-surface-container-lowest text-on-surface"
										>
											30 days
										</option>
										<option
											value="90"
											className="bg-surface-container-lowest text-on-surface"
										>
											90 days
										</option>
										<option
											value="0"
											className="bg-surface-container-lowest text-on-surface"
										>
											Unlimited
										</option>
									</select>
								</div>
							</div>
							{s.lastCheckedAt ? (
								<span className="hidden font-mono text-mono-technical text-on-tertiary-container sm:block">
									{s.lastCheckedAt.toLocaleString()}
								</span>
							) : null}
							<div className="flex items-center gap-1">
								<button
									onClick={() => toggle.mutate(s)}
									className={`flex h-6 w-11 items-center rounded-full px-0.5 transition-colors ${s.enabled ? "bg-primary" : "bg-outline-variant"}`}
									aria-label={s.enabled ? "Disable" : "Enable"}
								>
									<span
										className={`h-5 w-5 rounded-full bg-surface-container-lowest shadow transition-transform ${s.enabled ? "translate-x-5" : "translate-x-0"}`}
									/>
								</button>
								<button
									onClick={() => remove.mutate(s.id)}
									className="ml-2 p-2 text-on-surface-variant transition-colors hover:text-error"
									aria-label="Remove"
								>
									<Icon name="delete" className="text-[18px]" />
								</button>
							</div>
						</GhostCard>
					))}
				</div>
			)}
		</section>
	);
}

function AddSourceForm({ onDone }: { onDone: () => void }) {
	const queryClient = useQueryClient();
	const [name, setName] = useState("");
	const [url, setUrl] = useState("");
	const [type, setType] = useState<SourceType>("rss");
	const [category, setCategory] = useState<SourceCategory>("ai");

	const create = useMutation({
		mutationFn: (input: CreateSourceInput) => createSource(input),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["sources"] });
			onDone();
		},
	});

	const submit = () => {
		if (!name.trim() || !url.trim()) return;
		const configuration =
			type === "rss"
				? { feedUrl: url }
				: type === "sitemap"
					? { sitemapUrl: url }
					: { baseUrl: url };
		create.mutate({ name, url, type, category, configuration });
	};

	return (
		<GhostCard className="mb-8 space-y-4 border-l-2 border-l-primary">
			<h3 className="font-label text-label-md uppercase tracking-wide text-primary">
				Add new source
			</h3>
			<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
				<div>
					<label className="font-label text-label-sm uppercase tracking-wide text-on-surface-variant">
						Name
					</label>
					<Input
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="OpenAI Blog"
					/>
				</div>
				<div>
					<label className="font-label text-label-sm uppercase tracking-wide text-on-surface-variant">
						URL
					</label>
					<Input
						value={url}
						onChange={(e) => setUrl(e.target.value)}
						placeholder="https://openai.com/blog/rss.xml"
						icon="link"
					/>
				</div>
				<div>
					<label className="font-label text-label-sm uppercase tracking-wide text-on-surface-variant">
						Method
					</label>
					<div className="mt-1 flex flex-wrap gap-2">
						{TYPES.map((t) => (
							<button
								key={t}
								onClick={() => setType(t)}
								className={`rounded border px-3 py-1 font-label text-label-sm uppercase tracking-wide transition-colors ${
									type === t
										? "border-primary bg-primary text-on-primary"
										: "border-outline-variant text-on-surface-variant hover:border-primary"
								}`}
							>
								{t}
							</button>
						))}
					</div>
				</div>
				<div>
					<label className="font-label text-label-sm uppercase tracking-wide text-on-surface-variant">
						Category
					</label>
					<select
						value={category}
						onChange={(e) => setCategory(e.target.value as SourceCategory)}
						className="mt-1 w-full border border-outline-variant bg-transparent px-4 py-3 font-mono text-mono-technical outline-none focus:border-secondary"
					>
						{CATEGORIES.map((c) => (
							<option
								key={c}
								value={c}
								className="bg-surface-container-lowest text-on-surface"
							>
								{c}
							</option>
						))}
					</select>
				</div>
			</div>
			{create.error ? (
				<p className="font-mono text-mono-technical text-error">
					{create.error.message}
				</p>
			) : null}
			<div className="flex justify-end gap-2">
				<Button variant="ghost" size="sm" onClick={onDone}>
					Cancel
				</Button>
				<Button
					size="sm"
					icon="check"
					onClick={submit}
					disabled={create.isPending}
				>
					{create.isPending ? "Saving…" : "Add"}
				</Button>
			</div>
		</GhostCard>
	);
}

function typeIcon(type: SourceType): string {
	switch (type) {
		case "rss":
			return "rss_feed";
		case "api":
			return "api";
		case "html":
			return "html";
		case "sitemap":
			return "map";
		default:
			return "database";
	}
}
