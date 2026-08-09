import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { UsageSummary } from "@vorynth/types";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { DomainTag } from "@/components/ui/Badge";
import { GhostCard } from "@/components/ui/GhostCard";
import { fetchUsage, resetUsage } from "@/features/llm/usage-api.js";
import { fetchStatus } from "@/features/llm/llm-api.js";

/**
 * Usage panel (Settings) — token + request spend across the engine's history.
 *
 * Surfaces:
 *   - total tokens (prompt + completion)
 *   - total requests, including failures
 *   - last-30-day rollup
 *   - per-operation and per-provider breakdowns
 *   - live rate-limit state (from the engine's own limiter — not a build-time guess)
 */
export function UsageSection() {
	const { t } = useTranslation();
	const queryClient = useQueryClient();
	const { data } = useQuery<UsageSummary>({
		queryKey: ["llm-usage"],
		queryFn: fetchUsage,
		refetchInterval: 5_000,
	});
	// Live limiter state straight from the engine (`/llm/status`). This is the
	// single source of truth for the rate limit — the UI no longer guesses
	// from a build-time env var, so VITE_LLM_RPM can't drift from VORYNTH_LLM_RPM.
	const { data: status } = useQuery({
		queryKey: ["llm-status"],
		queryFn: fetchStatus,
		refetchInterval: 5_000,
	});
	const reset = useMutation({
		mutationFn: resetUsage,
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["llm-usage"] }),
	});

	const rateLimit = status?.rateLimit ?? {
		capacity: 0,
		inFlight: 0,
		spacingMs: 0,
	};
	const u = data ?? {
		totalRequests: 0,
		totalTokens: 0,
		promptTokens: 0,
		completionTokens: 0,
		failedRequests: 0,
		byOperation: {},
		byProvider: {},
		last30d: { requests: 0, tokens: 0 },
		windowStart: new Date().toISOString(),
	};

	return (
		<GhostCard>
			<div className="mb-4 flex items-center justify-between">
				<h3 className="flex items-center gap-2 font-label text-label-md uppercase tracking-widest text-on-surface-variant">
					<Icon name="monitor" className="text-base" />
					{t("usage.title")}
				</h3>
				<Button
					variant="ghost"
					size="sm"
					icon="restart_alt"
					onClick={() => reset.mutate()}
					disabled={reset.isPending}
				>
					{t("usage.reset")}
				</Button>
			</div>

			<div className="grid grid-cols-2 gap-4 md:grid-cols-4">
				<Stat
					label={t("usage.totalRequests")}
					value={u.totalRequests.toLocaleString()}
					sub={t("usage.failed", { count: u.failedRequests })}
				/>
				<Stat
					label={t("usage.totalTokens")}
					value={u.totalTokens.toLocaleString()}
					sub={t("usage.tokenBreakdown", {
						prompt: u.promptTokens.toLocaleString(),
						completion: u.completionTokens.toLocaleString(),
					})}
				/>
				<Stat
					label={t("usage.last30Days")}
					value={u.last30d.requests.toLocaleString()}
					sub={t("search.tokensUsed", {
						count: u.last30d.tokens.toLocaleString(),
					})}
				/>
				<Stat
					label={t("usage.rateLimit")}
					value={`${rateLimit.inFlight}/${rateLimit.capacity}`}
					sub={t("usage.spacing", {
						seconds: (rateLimit.spacingMs / 1000).toFixed(1),
					})}
				/>
			</div>

			<div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
				<Breakdown title={t("usage.byOperation")} data={u.byOperation} />
				<Breakdown title={t("usage.byProvider")} data={u.byProvider} />
			</div>

			<p className="mt-4 font-mono text-[11px] text-on-tertiary-container">
				{t("usage.sinceHint", {
					date: new Date(u.windowStart).toLocaleDateString(),
				})}
			</p>
		</GhostCard>
	);
}

function Stat({
	label,
	value,
	sub,
}: {
	label: string;
	value: string;
	sub?: string;
}) {
	return (
		<div className="border-s-2 border-s-outline-variant ps-3">
			<p className="font-label text-label-sm uppercase tracking-widest text-on-tertiary-container">
				{label}
			</p>
			<p className="mt-1 font-mono text-mono-technical text-primary dir-ltr-isolate">
				{value}
			</p>
			{sub ? (
				<p className="font-mono text-[11px] text-on-tertiary-container dir-ltr-isolate">
					{sub}
				</p>
			) : null}
		</div>
	);
}

function Breakdown({
	title,
	data,
}: {
	title: string;
	data: Record<string, { requests: number; tokens: number }>;
}) {
	const { t } = useTranslation();
	const entries = Object.entries(data).sort(
		(a, b) => b[1].tokens - a[1].tokens,
	);
	return (
		<div>
			<p className="mb-3 font-label text-label-sm uppercase tracking-widest text-on-surface-variant">
				{title}
			</p>
			{entries.length === 0 ? (
				<p className="font-body text-body-md text-on-tertiary-container">
					{t("usage.noData")}
				</p>
			) : (
				<div className="space-y-2">
					{entries.map(([name, v]) => (
						<div
							key={name}
							className="flex items-center justify-between border-b border-outline-variant pb-1"
						>
							<DomainTag>{name}</DomainTag>
							<span className="font-mono text-mono-technical text-on-surface dir-ltr-isolate">
								{t("usage.breakdownLine", {
									requests: v.requests,
									tokens: v.tokens.toLocaleString(),
								})}
							</span>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
