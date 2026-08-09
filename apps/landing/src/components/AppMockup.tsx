import { AppPreview } from "./AppPreview";

/** A faithful Today's Brief preview — the REAL desktop ShellLayout + BriefPage
 *  screens (from @/ → apps/desktop/src), fed static data by mock-engine.ts.
 *  The window frame around them is the only landing-specific chrome. */
export function AppMockup() {
	return (
		<div className="app-mock" aria-label="Vorynth app preview">
			<div className="preview-window">
				<AppPreview />
			</div>
		</div>
	);
}
