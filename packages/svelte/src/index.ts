// @iris-ui/svelte — Svelte 5 adapter. Thin bridges over @iris-ui/core; same
// component names + semantics as @iris-ui/react, @iris-ui/vue, @iris-ui/solid.

export { toStore } from './useStore'

// ── Layer 0: theme + skins ────────────────────────────────────────────────────
export * from './theme'
export * from './skins'

// ── Layouts ───────────────────────────────────────────────────────────────────
export * from './layouts'

// ── Primitives ────────────────────────────────────────────────────────────────
export * from './primitives/button'
export * from './primitives/icon'

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
