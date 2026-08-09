/**
 * Host shim: `react/jsx-runtime` — esbuild automatic-JSX transform imports
 * `jsx`/`jsxs`/`Fragment` from here; route them to the app's React.
 */
import type * as ReactNS from "react";

const host = (
	window as unknown as { __VORYNTH_HOST__?: { React: typeof ReactNS } }
).__VORYNTH_HOST__;
const React = host?.React;
const missing = "plugin host not ready — PluginHostProvider must mount first";

export const jsx =
	React?.createElement ??
	(() => {
		throw new Error(missing);
	});
export const jsxs =
	React?.createElement ??
	(() => {
		throw new Error(missing);
	});
export const Fragment =
	React?.Fragment ??
	(() => {
		throw new Error(missing);
	});
