// @iris-ui/solid — SolidJS adapter. Thin bridges over @iris-ui/core; same
// component names + semantics as @iris-ui/react and @iris-ui/vue.

export { useStore } from './useStore'
export { useMachine } from './useMachine'

// ── Layer 0: theme + skins ─────────────────────────────────────────────────
export * from './theme'
export * from './skins'

// ── Layouts + admin ───────────────────────────────────────────────────────────
export * from './layouts'
export * from './admin'

// ── Primitives ───────────────────────────────────────────────────────────────
export * from './floating'
export * from './primitives/button'
export * from './primitives/icon'
export * from './primitives/breadcrumb'
export * from './primitives/dropdown'
export * from './primitives/badge'
export * from './primitives/avatar'
export * from './primitives/form-field'
export * from './primitives/input'
export * from './primitives/switch'

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
