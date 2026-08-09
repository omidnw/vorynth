/**
 * Host shim: `react-dom` — routes portals to the app's ReactDOM.
 * Most plugins don't render to the DOM themselves; provided for completeness.
 */
import type * as ReactDOMNS from "react-dom";

const host = (
	window as unknown as { __VORYNTH_HOST__?: { ReactDOM: typeof ReactDOMNS } }
).__VORYNTH_HOST__;
const ReactDOM = host?.ReactDOM;
const missing = "plugin host not ready — PluginHostProvider must mount first";

export const createPortal =
	ReactDOM?.createPortal ??
	(() => {
		throw new Error(missing);
	});
