// @iris-ui/svelte — Svelte 5 adapter. Thin bridges over @iris-ui/core; same
// component names + semantics as @iris-ui/react, @iris-ui/vue, @iris-ui/solid.

export { toStore } from './useStore'
export { toMachine } from './useMachine'

// ── Layer 0: theme + skins ────────────────────────────────────────────────────
export * from './theme'
export * from './skins'

// ── Layouts ───────────────────────────────────────────────────────────────────
export * from './layouts'

// ── Primitives ────────────────────────────────────────────────────────────────
export * from './floating'
export * from './primitives/button'
export * from './primitives/icon'
export * from './primitives/dropdown'
export * from './primitives/breadcrumb'
export * from './primitives/badge'
export * from './primitives/avatar'
export * from './primitives/form-field'
export * from './primitives/input'
export * from './primitives/switch'

// ── Framework-agnostic theme + token re-exports (mirror the sibling adapters) ──
export {
  applyTheme,
  toCssVarName,
  getCssVar,
  createThemeStore,
  type ApplyThemeResult,
  type ThemeStore,
  type ThemeStoreConfig,
} from '@iris-ui/theme'

export {
  lightTheme,
  darkTheme,
  type IrisTheme,
  type IrisThemeType,
  type IrisThemeColors,
} from '@iris-ui/tokens'
