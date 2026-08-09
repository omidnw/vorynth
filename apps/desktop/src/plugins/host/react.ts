/**
 * Host shim: `react` — re-exports the app's single React instance.
 *
 * Plugin bundles are compiled with esbuild aliasing `react` → this file, so a
 * plugin's JSX and hooks resolve to the SAME React the app uses (no duplicate
 * copy, shared context, shared state). The real instance is handed over at
 * runtime through `window.__VORYNTH_HOST__.React` (set by PluginHostProvider).
 */
import type * as ReactNS from "react";

const host = (
	window as unknown as { __VORYNTH_HOST__?: { React: typeof ReactNS } }
).__VORYNTH_HOST__;
const React = host?.React;

const missing =
	"plugin host not ready — PluginHostProvider must mount before any plugin bundle loads";

export default React;
export const useState =
	React?.useState ??
	(() => {
		throw new Error(missing);
	});
export const useEffect =
	React?.useEffect ??
	(() => {
		throw new Error(missing);
	});
export const useMemo =
	React?.useMemo ??
	(() => {
		throw new Error(missing);
	});
export const useCallback =
	React?.useCallback ??
	(() => {
		throw new Error(missing);
	});
export const useRef =
	React?.useRef ??
	(() => {
		throw new Error(missing);
	});
export const useContext =
	React?.useContext ??
	(() => {
		throw new Error(missing);
	});
export const useReducer =
	React?.useReducer ??
	(() => {
		throw new Error(missing);
	});
export const useLayoutEffect =
	React?.useLayoutEffect ??
	(() => {
		throw new Error(missing);
	});
export const useId =
	React?.useId ??
	(() => {
		throw new Error(missing);
	});
export const createElement =
	React?.createElement ??
	(() => {
		throw new Error(missing);
	});
export const createContext =
	React?.createContext ??
	(() => {
		throw new Error(missing);
	});
export const Fragment =
	React?.Fragment ??
	(() => {
		throw new Error(missing);
	});
export const forwardRef =
	React?.forwardRef ??
	(() => {
		throw new Error(missing);
	});
export const memo =
	React?.memo ??
	(() => {
		throw new Error(missing);
	});
export const Suspense =
	React?.Suspense ??
	(() => {
		throw new Error(missing);
	});
export const Children = React?.Children;
export const cloneElement =
	React?.cloneElement ??
	(() => {
		throw new Error(missing);
	});
export const isValidElement =
	React?.isValidElement ??
	(() => {
		throw new Error(missing);
	});
export const startTransition =
	React?.startTransition ?? ((cb: () => void) => cb());
export const StrictMode =
	React?.StrictMode ??
	(() => {
		throw new Error(missing);
	});
