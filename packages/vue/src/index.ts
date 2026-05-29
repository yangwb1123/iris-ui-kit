// =============================================================================
// @iris-ui/vue — public barrel
// =============================================================================
//
// Re-exports follow the 5-layer architecture in AGENTS.md:
//
//   Layer 0  Theme System            — theme provider + composables
//            Machine bridge          — useMachine adapter for @iris-ui/core
//
//   Layer 1  Meta Primitives         — Slot, Button, Floating hooks,
//                                      Popover / Tooltip / Dialog,
//                                      Input / Switch / Checkbox / Radio,
//                                      List / Select, drag utilities
//
//   Layer 2  Composite Components    — Splitter, Resizer, Dragger,
//                                      Table, VirtualScroll,
//                                      Tabs, Dropdown, Menu, Toast, Tree
//
//   Layer 3  Layouts                 — Sidebar / Header / DashboardGrid
//
// Re-exports from peer packages live at the bottom for convenience so
// consumers can `import { lightTheme, applyTheme } from '@iris-ui/vue'`
// without juggling every sub-package.

// ── Layer 0 ──────────────────────────────────────────────────────────────────
export * from './theme'
export * from './machine'
export * from './form'
export * from './i18n'
export * from './async'

// ── Layer 1 · Meta Primitives ────────────────────────────────────────────────
export * from './primitives/slot'
export * from './primitives/button'
export * from './primitives/floating'
export * from './primitives/popover'
export * from './primitives/tooltip'
export * from './primitives/dialog'
export * from './primitives/drawer'
export * from './primitives/modal-utils'
export * from './primitives/input'
export * from './primitives/textarea'
export * from './primitives/number-input'
export * from './primitives/otp-input'
export * from './primitives/rating'
export * from './primitives/combobox'
export * from './primitives/password-input'
export * from './primitives/form-field'
export * from './primitives/switch'
export * from './primitives/checkbox'
export * from './primitives/radio'
export * from './primitives/list'
export * from './primitives/select'
export * from './primitives/drag'
export * from './primitives/badge'
export * from './primitives/avatar'
export * from './primitives/spinner'
export * from './primitives/icon'
export * from './primitives/skeleton'
export * from './primitives/progress'
export * from './primitives/alert'
export * from './primitives/banner'
export * from './primitives/slider'
export * from './primitives/pagination'
export * from './primitives/card'
export * from './primitives/divider'
export * from './primitives/breadcrumb'
export * from './primitives/empty-state'
export * from './primitives/chip'
export * from './primitives/accordion'
export * from './primitives/stepper'
export * from './primitives/toggle-group'
export * from './primitives/kbd'

// ── Layer 2 · Composite Components ───────────────────────────────────────────
export * from './primitives/splitter'
export * from './primitives/resizer'
export * from './primitives/dragger'
export * from './primitives/virtual-scroll'
export * from './primitives/table'
export * from './primitives/tabs'
export * from './primitives/dropdown'
export * from './primitives/menu'
export * from './primitives/toast'
export * from './primitives/tree'
export * from './primitives/timeline'
export * from './primitives/carousel'
export * from './primitives/statistic'
export * from './primitives/descriptions'
export * from './primitives/transfer'
export * from './primitives/watermark'
export * from './primitives/back-top'
export * from './primitives/affix'
export * from './primitives/result'
export * from './primitives/tree-select'
export * from './primitives/calendar'
export * from './primitives/date-picker'
export * from './primitives/file-upload'
export * from './primitives/range-slider'
export * from './primitives/color-picker'
export * from './primitives/command-palette'
export * from './primitives/time-picker'
export * from './primitives/date-range-picker'

// ── Layer 3 · Layouts ────────────────────────────────────────────────────────
export * from './layouts'

// ── Layer 4 · System Skeletons ───────────────────────────────────────────────
export * from './skeletons'

// ── Behaviors (orthogonal capability layer) ──────────────────────────────────
export * from './behaviors'

// ── Re-exports from peer packages ────────────────────────────────────────────
export {
  createStore,
  createMachine,
  createFloatingMachine,
  composeEventHandlers,
  mergeProps,
  generateId,
  type Store,
  type Machine,
  type MachineEvent,
  type MachineState,
  type MachineConfig,
  type Transition,
  type StateNode,
  type FloatingMachine,
  type FloatingState,
  type FloatingEvent,
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
  COLOR_TOKENS,
  SPACING_TOKENS,
  RADII_TOKENS,
  ALL_TOKEN_NAMES,
  type IrisTheme,
  type IrisThemeType,
  type IrisThemeColors,
  type IrisThemeSpacing,
  type IrisThemeRadii,
  type ColorToken,
  type SpacingToken,
  type RadiusToken,
  type AnyToken,
} from '@iris-ui/tokens'

// Icon system runtime + types. The `IrisIcon` *component* (Layer 1) owns that
// name; the data interface is available from '@iris-ui/icons' directly.
export {
  defaultIcons,
  defaultIconRegistry,
  resolveIcon,
  createIconRegistry,
  renderIconSvg,
  resolveThemedIcon,
  type IrisIconNode,
  type IrisIconSet,
  type IrisIconResolver,
  type IrisIconRegistry,
  type CreateIconRegistryOptions,
  type RenderIconOptions,
  type ThemeIconConfig,
} from '@iris-ui/icons'
