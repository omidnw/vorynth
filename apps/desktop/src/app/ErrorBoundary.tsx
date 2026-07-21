import { Component, type ErrorInfo, type ReactNode } from "react";

interface State {
	hasError: boolean;
	error?: Error;
}

/**
 * Top-level error boundary. Catches render-time errors anywhere in the tree
 * so a single broken component doesn't blank the whole app — the user sees
 * what went wrong and can navigate away.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
	override state: State = { hasError: false };

	static getDerivedStateFromError(error: Error): State {
		return { hasError: true, error };
	}

	override componentDidCatch(error: Error, info: ErrorInfo) {
		console.error("Vorynth render error:", error, info.componentStack);
	}

	override render() {
		if (this.state.hasError) {
			return (
				<div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
					<h1 className="mb-2 font-headline text-headline-lg text-primary">
						Something went wrong
					</h1>
					<p className="mb-6 max-w-md font-body text-body-md text-on-surface-variant">
						The UI hit an unexpected error. Reload to try again; if it persists,
						check the engine is running on the configured port.
					</p>
					{this.state.error ? (
						<pre className="mb-6 max-w-lg overflow-auto rounded border border-outline-variant bg-surface-container-low p-4 text-left font-mono text-[11px] text-error">
							{this.state.error.message}
						</pre>
					) : null}
					<button
						onClick={() => window.location.reload()}
						className="rounded bg-primary px-6 py-3 font-label text-label-md uppercase tracking-wider text-on-primary"
					>
						Reload
					</button>
				</div>
			);
		}
		return this.props.children;
	}
}
