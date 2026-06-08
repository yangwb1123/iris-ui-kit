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
export * from './primitives/divider'
export * from './primitives/kbd'
export * from './primitives/visually-hidden'
export * from './primitives/spinner'
export * from './primitives/skeleton'
export * from './primitives/alert'
export * from './primitives/empty-state'
export * from './primitives/result'
export * from './primitives/statistic'
export * from './primitives/ribbon'
export * from './primitives/descriptions'
export * from './primitives/list'
export * from './primitives/card'
export * from './primitives/image'
export * from './primitives/aspect-ratio'
export * from './primitives/watermark'
export * from './primitives/accordion'
export * from './primitives/checkbox'
export * from './primitives/radio'
export * from './primitives/progress'
export * from './primitives/progress-circle'
export * from './primitives/gauge'
export * from './primitives/countdown'
export * from './primitives/pagination'
export * from './primitives/timeline'
export * from './primitives/stepper'
export * from './primitives/rating'
export * from './primitives/segmented'
export * from './primitives/chip'
export * from './primitives/copy-button'
export * from './primitives/banner'
export * from './primitives/fieldset'
export * from './primitives/textarea'
export * from './primitives/number-input'
export * from './primitives/password-input'
export * from './primitives/otp-input'
export * from './primitives/tag-input'
export * from './primitives/file-upload'
export * from './primitives/slider'
export * from './primitives/range-slider'
export * from './primitives/tabs'
export * from './primitives/toggle-group'
export * from './primitives/toolbar'
export * from './primitives/affix'
export * from './primitives/back-top'
export * from './primitives/anchor'
export * from './primitives/float-button'
export * from './primitives/scroll-area'

// ── Tier 4: Overlay + utility components ─────────────────────────────────────
export * from './modal-utils'
export * from './primitives/tooltip'
export * from './primitives/popover'
export * from './primitives/menu'
export * from './primitives/dialog'
export * from './primitives/drawer'
export * from './primitives/select'
export * from './primitives/combobox'
export * from './primitives/split-button'
export * from './primitives/splitter'
export * from './primitives/resizer'
export * from './primitives/dragger'
export * from './primitives/masonry'
export * from './primitives/marquee'
export * from './primitives/virtual-scroll'
export * from './primitives/table'
export * from './primitives/tour'

// ── Tier 5: Complex & Modules ─────────────────────────────────────────────────
export * from './primitives/slot'
export * from './primitives/calendar'
export * from './primitives/date-picker'
export * from './primitives/date-range-picker'
export * from './primitives/time-picker'
export * from './primitives/command-palette'
export * from './primitives/color-picker'
export * from './primitives/mentions'
export * from './primitives/cascader'
export * from './primitives/tree'
export * from './primitives/tree-select'
export * from './primitives/transfer'
export * from './primitives/carousel'

// ── Utility modules ──────────────────────────────────────────────────────────
export * from './behaviors'
export * from './async'
export * from './form'
export * from './i18n'
export * from './motion'
export * from './skeletons'

// ── Plugin system: unified IrisProvider + consumer hooks ──────────────────────
export * from './provider'

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
