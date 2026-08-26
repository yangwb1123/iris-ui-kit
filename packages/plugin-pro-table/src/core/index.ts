/**
 * `@iris-ui-kit/plugin-pro-table` — a vxe-table-style CRUD data table for Iris UI.
 * This `core` entry is framework-agnostic: {@link createProTableStore} owns all
 * the table logic behind a subscribable {@link Store}. Per the re-layering, it
 * is now a **composition** of @iris-ui-kit/core controllers rather than a monolith:
 * selection → `createSelectionModel`, the filter→sort→paginate pipeline →
 * `filterSort`/`paginate`/`cycleSort`, server loading → `createAsyncResource`
 * (token-guarded, no stale-response clobbering), CSV → `toCsv`. The four
 * framework entries are render-only adapters that read this store.
 */

export type { SortDirection, SortState, TreeRow } from '@iris-ui-kit/core'

export type {
  CellEditEvent,
  CellEditor,
  ProTableColumn,
  ProTableConfig,
  ProTableMode,
  ProTableMutateOptions,
  ProTableMutationKind,
  ProTableMutations,
  ProTableMutationState,
  ProTableQuery,
  ProTableState,
  ProTableStore,
  ProTableTreeConfig,
  ProTableLabels,
  ProTableViewOptions,
} from './types'
export * from './view'
export * from './grid'
export { proTablePlugin } from './plugin'
export { createProTableStore } from './store-engine'
