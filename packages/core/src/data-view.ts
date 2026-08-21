/**
 * Framework-agnostic data-grid logic.
 *
 * The public module stays a stable barrel while each pure concern lives in a
 * focused file: filtering/sorting, aggregation, tree flattening, pagination,
 * and grouped-view state. Existing `@iris-ui-kit/core` imports therefore keep
 * working without carrying the whole implementation in one module.
 */

export * from './data-view/types'
export * from './data-view/filter-sort'
export * from './data-view/aggregate'
export * from './data-view/tree'
export * from './data-view/pagination'
export { createGroupedView, type GroupedViewStore } from './data-view/grouped-view'
