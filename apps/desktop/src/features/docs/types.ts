/**
 * Shared types for the in-app Documentation & Tutorial content.
 *
 * v1.9.0: the block/section shapes moved to `@vorynth/types` so runtime UI
 * plugins and the engine reference one contract. This module re-exports them —
 * desktop docs sections keep importing `../types.js` unchanged.
 */

export type { DocsBlock, DocsSection, FlowStep } from "@vorynth/types";
