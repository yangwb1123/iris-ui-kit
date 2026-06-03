// @iris-ui/svelte — Svelte 5 adapter. Thin bridges over @iris-ui/core; same
// component names + semantics as @iris-ui/react, @iris-ui/vue, @iris-ui/solid.

export { toStore } from './useStore'

// ── Primitives ───────────────────────────────────────────────────────────────
export { IrisButton } from './primitives/button'
export type { IrisButtonVariant, IrisButtonSize, IrisButtonType } from './primitives/button'
