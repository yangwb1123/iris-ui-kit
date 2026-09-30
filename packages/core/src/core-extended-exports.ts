export type { Side, Align, Placement, Size, Variant } from './types'
export { composeEventHandlers, mergeProps, generateId, safeArray, safeNumber } from './utils'
/**
 * Framework-agnostic `asChild` merge semantics. Adapters keep only element
 * resolution, ref plumbing, and their own renderer's prop delivery.
 */
export * from './slot'
export {
  createPlugin,
  runPlugins,
  reloadPlugins,
  namespaceTokenKey,
  namespaceStoreKey,
  validateNamespace,
  detectNamespaceConflicts,
  createNamespacedRegistry,
  NAMESPACE_SEPARATOR,
  type IrisPlugin,
  type PluginRegistry,
  type CollectedRegistrations,
} from './plugin'
export * from './grid'
export {
  createCellRange,
  type CellAddress,
  type CellRange,
  type CellRangeState,
  type CellRangeController,
} from './cell-range'
export {
  createSortable,
  closestCenter,
  type SortablePoint,
  type SortableRect,
  type SortableState,
  type SortableController,
} from './sortable'
export {
  createKeyboardNav,
  type KeyboardNavController,
  type KeyboardNavConfig,
  type KeyboardNavAction,
} from './keyboard-nav'
export {
  parseTableKey,
  normalizeKeymap,
  matchTableKey,
  formatKeyBinding,
  formatKeyBindings,
  TABLE_KEY_ACTIONS,
  DEFAULT_TABLE_KEYMAP,
  type IrisTableKeyAction,
  type IrisTableKeymap,
  type TableKeyBinding,
  type TableKeyEvent,
  type NormalizedTableKeymap,
} from './keymap'

export * from './resilience-exports'
