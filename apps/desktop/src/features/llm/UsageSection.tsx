import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UsageSummary } from "@vorynth/types";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { DomainTag } from "@/components/ui/Badge";
import { GhostCard } from "@/components/ui/GhostCard";
import { fetchUsage, resetUsage } from "@/features/llm/usage-api.js";

/**
 * Usage panel (Settings) — token + request spend across the engine's history.
 *
 * Surfaces:
 *   - total tokens (prompt + completion)
 *   - total requests, including failures
 *   - last-30-day rollup
 *   - per-operation and per-provider breakdowns
 *   - live rate-limit state
 */
export function UsageSection({
	rateLimit,
}: {
	rateLimit: { capacity: number; inFlight: number };
}) {
	const queryClient = useQueryClient();
	const { data } = useQuery<UsageSummary>({
		queryKey: ["llm-usage"],
		queryFn: fetchUsage,
		refetchInterval: 5_000,
	});
	const reset = useMutation({
		mutationFn: resetUsage,
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["llm-usage"] }),
	});

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
					<Icon name="monitoring" className="text-base" />
					Usage
				</h3>
				<Button
					variant="ghost"
					size="sm"
					icon="restart_alt"
					onClick={() => reset.mutate()}
					disabled={reset.isPending}
				>
					Reset
				</Button>
			</div>

			<div className="grid grid-cols-2 gap-4 md:grid-cols-4">
				<Stat
					label="Total requests"
					value={u.totalRequests.toLocaleString()}
					sub={`${u.failedRequests} failed`}
				/>
				<Stat
					label="Total tokens"
					value={u.totalTokens.toLocaleString()}
					sub={`${u.promptTokens.toLocaleString()} in · ${u.completionTokens.toLocaleString()} out`}
				/>
				<Stat
					label="Last 30 days"
					value={u.last30d.requests.toLocaleString()}
					sub={`${u.last30d.tokens.toLocaleString()} tokens`}
				/>
				<Stat
					label="Rate limit"
					value={`${rateLimit.inFlight}/${rateLimit.capacity}`}
					sub="req/min in flight"
				/>
			</div>

			<div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
				<Breakdown title="By operation" data={u.byOperation} />
				<Breakdown title="By provider" data={u.byProvider} />
			</div>

			<p className="mt-4 font-mono text-[11px] text-on-tertiary-container">
				Counts since {new Date(u.windowStart).toLocaleDateString()}. Token
				counts are estimated (4 chars ≈ 1 token) when a provider doesn't expose
				metadata.
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
		<div className="border-l-2 border-outline-variant pl-3">
			<p className="font-label text-label-sm uppercase tracking-widest text-on-tertiary-container">
				{label}
			</p>
			<p className="mt-1 font-mono text-mono-technical text-primary">{value}</p>
			{sub ? (
				<p className="font-mono text-[11px] text-on-tertiary-container">
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
					No data yet.
				</p>
			) : (
				<div className="space-y-2">
					{entries.map(([name, v]) => (
						<div
							key={name}
							className="flex items-center justify-between border-b border-outline-variant pb-1"
						>
							<DomainTag>{name}</DomainTag>
							<span className="font-mono text-mono-technical text-on-surface">
								{v.requests} req · {v.tokens.toLocaleString()} tok
							</span>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
