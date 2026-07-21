import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { GhostCard } from "@/components/ui/GhostCard";
import { useJobsStore } from "@/features/jobs/jobs-store.js";

/**
 * Onboarding flow (examples/welcome.html).
 *
 * Step 1: Welcome / privacy framing.
 * Step 2: Optional LLM provider — user may SKIP and stay in news mode.
 * Step 3: Trigger first collection and enter the app.
 *
 * The API key step is genuinely optional — Vorynth is useful with zero
 * configuration. This is the key UX shift from the original plan.
 */
export function OnboardingPage() {
	const [step, setStep] = useState<1 | 2 | 3>(1);
	const navigate = useNavigate();
	const progress = (step / 3) * 100;

	return (
		<div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
			<header className="mb-12 text-center">
				<h1 className="mb-1 font-headline text-headline-lg tracking-tight text-primary dark:text-primary-fixed">
					Vorynth
				</h1>
				<p className="font-body text-body-md italic text-on-surface-variant">
					Less reading. More understanding.
				</p>
			</header>

			<div className="flex w-full max-w-[540px] min-h-[460px] flex-col">
				{step === 1 ? <StepWelcome onNext={() => setStep(2)} /> : null}
				{step === 2 ? (
					<StepProvider onBack={() => setStep(1)} onNext={() => setStep(3)} />
				) : null}
				{step === 3 ? <StepFinish onFinish={() => navigate("/brief")} /> : null}
			</div>

			<footer className="fixed bottom-12 w-full max-w-[540px] px-6">
				<div className="relative h-1 overflow-hidden rounded-full bg-surface-variant/30">
					<div
						className="absolute left-0 top-0 h-full bg-primary transition-all duration-700 ease-out"
						style={{ width: `${progress}%` }}
					/>
				</div>
				<div className="mt-4 flex justify-between font-mono text-mono-technical text-[11px] text-on-tertiary-container">
					<span>STP_01: INTRO</span>
					<span>STP_02: PROV</span>
					<span>STP_03: INIT</span>
				</div>
			</footer>
		</div>
	);
}

function StepWelcome({ onNext }: { onNext: () => void }) {
	return (
		<div className="flex flex-col space-y-8">
			<div className="space-y-3 text-center">
				<h2 className="font-headline text-headline-md text-primary dark:text-primary-fixed">
					Establish Clarity
				</h2>
				<p className="font-body text-body-md text-on-surface-variant">
					Vorynth is your local-first engine for distilling vast technical
					knowledge into a short, ranked brief. No noise, just signals — and it
					works the moment you open it.
				</p>
			</div>
			<GhostCard className="flex items-start gap-4">
				<Icon name="shield" className="mt-1 text-primary" />
				<div>
					<p className="font-label text-label-md text-primary">
						Privacy Absolute
					</p>
					<p className="mt-1 font-mono text-mono-technical leading-relaxed text-on-tertiary-container">
						Sources, articles and your reading history stay on this device.
						Nothing leaves unless you configure an AI provider.
					</p>
				</div>
			</GhostCard>
			<div className="flex justify-center pt-8">
				<Button onClick={onNext}>Begin Setup</Button>
			</div>
		</div>
	);
}

function StepProvider({
	onBack,
	onNext,
}: {
	onBack: () => void;
	onNext: () => void;
}) {
	const [provider, setProvider] = useState<
		"skip" | "openai" | "gemini" | "ollama"
	>("openai");
	const [apiKey, setApiKey] = useState("");

	return (
		<div className="flex flex-col space-y-6">
			<div className="space-y-2">
				<h2 className="font-headline text-headline-md text-primary dark:text-primary-fixed">
					Engine Configuration
				</h2>
				<p className="font-body text-body-md text-on-surface-variant">
					Optional. Connect an AI provider to generate the Why-it-matters /
					Impact / Recommended-Action triad. Skip to stay in news mode.
				</p>
			</div>

			<div className="space-y-2">
				<label className="font-label text-label-sm uppercase text-on-tertiary-container">
					Select Provider
				</label>
				<div className="grid grid-cols-2 gap-3">
					{[
						{ id: "openai", icon: "cyclone", label: "OpenAI" },
						{ id: "gemini", icon: "auto_awesome", label: "Gemini" },
						{ id: "ollama", icon: "terminal", label: "Ollama (local)" },
						{ id: "skip", icon: "block", label: "Skip — News only" },
					].map((p) => (
						<button
							key={p.id}
							onClick={() => setProvider(p.id as typeof provider)}
							className={`flex flex-col items-center gap-2 border p-4 transition-all ${
								provider === p.id
									? "border-primary bg-surface-container-low"
									: "border-outline-variant hover:border-primary"
							}`}
						>
							<Icon
								name={p.icon}
								className={
									provider === p.id
										? "text-primary"
										: "text-on-tertiary-container"
								}
							/>
							<span className="font-label text-label-md">{p.label}</span>
						</button>
					))}
				</div>
			</div>

			{provider !== "skip" ? (
				<div className="space-y-2">
					<label className="font-label text-label-sm uppercase text-on-tertiary-container">
						API Key
					</label>
					<Input
						type="password"
						value={apiKey}
						onChange={(e) => setApiKey(e.target.value)}
						placeholder="sk-..."
						icon="lock"
					/>
					<p className="flex items-center gap-2 font-mono text-[11px] text-on-tertiary-container">
						<Icon name="lock" className="text-[14px]" />
						Stored encrypted locally; never sent anywhere except the provider.
					</p>
				</div>
			) : (
				<div className="border-l-2 border-secondary bg-surface-container-low p-4 rounded">
					<p className="font-body text-body-md text-on-surface-variant">
						News mode: Vorynth will collect and rank stories from your sources
						without any AI. You can add a provider later in Settings.
					</p>
				</div>
			)}

			<div className="flex items-center justify-between pt-6">
				<Button variant="ghost" size="sm" icon="arrow_back" onClick={onBack}>
					Back
				</Button>
				<Button onClick={onNext}>Continue</Button>
			</div>
		</div>
	);
}

function StepFinish({ onFinish }: { onFinish: () => void }) {
	const [collecting, setCollecting] = useState(false);
	const { startCollect } = useJobsStore();

	const initialize = async () => {
		setCollecting(true);
		// Kick off collect as a background job so it survives navigation.
		await startCollect();
		onFinish();
	};

	return (
		<div className="flex flex-col gap-4 pt-8">
			<div className="space-y-3 text-center">
				<h2 className="font-headline text-headline-md text-primary dark:text-primary-fixed">
					Ready
				</h2>
				<p className="font-body text-body-md text-on-surface-variant">
					Vorynth will now pull the latest stories from your sources. This takes
					a moment.
				</p>
			</div>
			<Button
				block
				size="lg"
				icon="bolt"
				iconFill
				onClick={initialize}
				disabled={collecting}
			>
				{collecting ? "Initializing…" : "Initialize Engine"}
			</Button>
			<p className="text-center font-mono text-[10px] uppercase tracking-widest text-on-tertiary-container">
				System Readiness: Optimal
			</p>
		</div>
	);
}
