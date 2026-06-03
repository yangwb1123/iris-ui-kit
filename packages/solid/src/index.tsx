// @iris-ui/solid — SolidJS adapter. Thin bridges over @iris-ui/core; same
// component names + semantics as @iris-ui/react and @iris-ui/vue.

export { useStore } from './useStore'
export { useMachine } from './useMachine'

// ── Layer 0: theme + skins ─────────────────────────────────────────────────
export * from './theme'
export * from './skins'

// ── Primitives ───────────────────────────────────────────────────────────────
export * from './primitives/button'

// ── Framework-agnostic re-exports (mirror @iris-ui/react / @iris-ui/vue) ───────
export {
  createStore,
  createMachine,
  composeEventHandlers,
  generateId,
  // NB: @iris-ui/core's `mergeProps` is intentionally NOT re-exported here —
  // it would shadow Solid's own `mergeProps`. Import it from @iris-ui/core if needed.
  type Store,
  type Machine,
  type Side,
  type Align,
  type Placement,
  type Size,
  type Variant,
} from '@iris-ui/core'

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
