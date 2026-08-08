/**
 * GroupedView controller — a framework-agnostic state model for grouping rows
 * by a key function with expand/collapse per group, optional group-level sort,
 * and per-group aggregate computation.
 *
 * This is an **independent** controller (composed atop the data source, not
 * embedded in the filter→sort→paginate pipeline). Consumers pass grouped rows
 * into their table adapter as a flat, indented list (like a TreeGrid) or as
 * section headers + children.
 *
 * Expansion is **composed** from {@link createExpansion} (multiple-open
 * semantics): the controller exposes the model as `expansion`, and every
 * expand/collapse method delegates to it. The grouped `state.expanded` is
 * derived from the model, so direct model calls (e.g. `gv.expansion.toggle(k)`)
 * stay in sync with the view — and `onExpandedChange` fires from the model's
 * single `onChange` site.
 *
 * Usage:
 * ```ts
 * const grouped = createGroupedView({ keyOf: (r) => r.category })
 * // After data arrives:
 * grouped.setRows(myRows)
 * // Read the computed state:
 * const state = grouped.getState()
 * // state.groups → [{ key: 'cat1', rows: [...] }, ...]
 * // state.expanded → Set of keys currently open
 * // Direct model access (additive):
 * grouped.expansion.expand('cat1')
 * ```
 */

import { createStore, type Store } from '../store'
import { createExpansion, type ExpansionModel } from '../expansion'
import { groupRows, aggregate as computeAggregate } from './aggregate'
import type { GroupedViewConfig, GroupedViewState, AggregateSpec, DataViewColumn } from './types'

/**
 * GroupedView controller state, stored in a subscribable {@link Store} so
 * framework adapters can bridge it to their reactivity model.
 */
export interface GroupedViewStore<Row, K extends string | number = string> {
  /** The raw config (keyOf, aggregates, groupSort, etc.). */
  config: GroupedViewConfig<Row, K>
  /** The current row set. */
  rows: readonly Row[]
  /** The derived group state. */
  state: GroupedViewState<Row, K>
  /** Columns reference for aggregate computation. */
  columns: readonly DataViewColumn<Row>[]
}

/**
 * Create a GroupedView controller. Initially empty; call {@link setRows} with
 * data to compute groups.
 *
 * The controller is designed to be **composed** with existing data sources:
 * the consumer feeds already-filtered/sorted/paginated rows into this
 * controller, which further groups them. Group-level expand/collapse and
 * optional group-key sort are managed here; per-group aggregates are computed
 * eagerly.
 */
export function createGroupedView<Row, K extends string | number = string>(
  config: GroupedViewConfig<Row, K>,
): {
  /** Subscribable store with the full grouped state. */
  store: Store<GroupedViewStore<Row, K>>
  /**
   * The composed expansion model (multiple-open). Direct model calls
   * (toggle/expand/collapse/set/merge) stay in sync with the grouped state —
   * every commit re-derives `state.expanded` and fires `onExpandedChange`.
   */
  expansion: ExpansionModel<K>
  /** Set the source rows (re-computes groups and aggregates). */
  setRows: (rows: readonly Row[], columns?: readonly DataViewColumn<Row>[]) => void
  /** Toggle a group's expanded state. */
  toggleGroup: (key: K) => void
  /** Expand a specific group. */
  expandGroup: (key: K) => void
  /** Collapse a specific group. */
  collapseGroup: (key: K) => void
  /** Expand all groups. */
  expandAll: () => void
  /** Collapse all groups. */
  collapseAll: () => void
  /** Get the current state snapshot. */
  getState: () => GroupedViewState<Row, K>
  /** Update the config (e.g., change keyOf or groupSort). Triggers recompute. */
  setConfig: (partial: Partial<GroupedViewConfig<Row, K>>) => void
} {
  let currentRows: readonly Row[] = []
  let currentColumns: readonly DataViewColumn<Row>[] = []

  const initialConfig: GroupedViewConfig<Row, K> = { ...config }
  let currentConfig: GroupedViewConfig<Row, K> = { ...initialConfig }

  function recompute(): void {
    store.setState((prev) => ({
      ...prev,
      state: buildState(currentRows, currentColumns, currentConfig),
    }))
  }

  // Composed expansion model — the single source of truth for open keys.
  // `defaultExpanded` also mirrors an initially-controlled `expanded` so the
  // first snapshot is correct without firing onChange during creation.
  const expansion = createExpansion<K>({
    mode: 'multiple',
    defaultExpanded: initialConfig.expanded ?? initialConfig.defaultExpanded,
    onChange: (keys) => {
      // Single firing site for onExpandedChange. In controlled mode the caller
      // drives the model via setConfig({ expanded }) — stay silent there
      // (preserves the historical silent-sync behavior).
      if (!currentConfig.expanded) currentConfig.onExpandedChange?.(keys)
      recompute()
    },
  })

  // Compute groups from rows.
  function computeGroups(
    rows: readonly Row[],
    keyOf: (row: Row) => K,
    groupSort?: 'asc' | 'desc',
  ): Array<{ key: K; rows: Row[] }> {
    if (rows.length === 0 || !keyOf) return []
    let groups = groupRows(rows, keyOf)
    // Apply group-level sort by key.
    if (groupSort) {
      const dir = groupSort === 'asc' ? 1 : -1
      groups = [...groups].sort((a, b) => {
        const ka = String(a.key)
        const kb = String(b.key)
        return ka.localeCompare(kb) * dir
      })
    }
    return groups
  }

  // Compute aggregate values per group.
  function computeAggregates(
    groups: Array<{ key: K; rows: Row[] }>,
    columns: readonly DataViewColumn<Row>[],
    aggregates: AggregateSpec[] | undefined,
  ): Map<K, Record<string, number>> {
    const result = new Map<K, Record<string, number>>()
    if (!aggregates || aggregates.length === 0) return result
    for (const group of groups) {
      const vals: Record<string, number> = {}
      for (const spec of aggregates) {
        const col = columns.find((c) => c.key === spec.key)
        if (col) {
          const outKey = `${spec.key}_${spec.op}`
          vals[outKey] = computeAggregate(group.rows, col.getValue, spec.op)
        }
      }
      result.set(group.key, vals)
    }
    return result
  }

  function buildState(
    rows: readonly Row[],
    columns: readonly DataViewColumn<Row>[],
    cfg: GroupedViewConfig<Row, K>,
  ): GroupedViewState<Row, K> {
    // Derived from the composed expansion model (setConfig mirrors an external
    // `expanded` into the model in controlled mode). Snapshot — callers cannot
    // mutate the internal set through the returned state.
    const expanded = new Set(expansion.get())
    const keyOf = cfg.keyOf
    if (!keyOf || rows.length === 0) {
      return { groups: [], aggregates: new Map(), expanded, isGrouped: false }
    }
    const groups = computeGroups(rows, keyOf, cfg.groupSort)
    const aggregates = computeAggregates(groups, columns, cfg.aggregates)
    return { groups, aggregates, expanded, isGrouped: true }
  }

  const initialStoreState: GroupedViewStore<Row, K> = {
    config: initialConfig,
    rows: [],
    state: buildState([], [], initialConfig),
    columns: [],
  }

  const store = createStore<GroupedViewStore<Row, K>>(initialStoreState)

  const api = {
    store,
    expansion,

    setRows(rows: readonly Row[], columns?: readonly DataViewColumn<Row>[]): void {
      currentRows = rows
      if (columns) currentColumns = columns
      recompute()
    },

    toggleGroup(key: K): void {
      if (currentConfig.expanded) return // controlled — caller drives via setConfig
      expansion.toggle(key)
    },

    expandGroup(key: K): void {
      if (currentConfig.expanded) return
      expansion.expand(key)
    },

    collapseGroup(key: K): void {
      if (currentConfig.expanded) return
      expansion.collapse(key)
    },

    expandAll(): void {
      if (currentConfig.expanded) return
      // Derive keys from the already-computed groups — zero extra keyOf calls
      // (deterministic; the model unions, matching createExpansion semantics).
      expansion.expandAll(store.getState().state.groups.map((g) => g.key))
    },

    collapseAll(): void {
      if (currentConfig.expanded) return
      expansion.collapseAll()
    },

    getState(): GroupedViewState<Row, K> {
      return store.getState().state
    },

    setConfig(partial: Partial<GroupedViewConfig<Row, K>>): void {
      currentConfig = { ...currentConfig, ...partial }
      // Controlled sync: mirror the new expanded set into the model. The
      // model's onChange re-derives the view state inside the same batch;
      // onExpandedChange stays silent in controlled mode (historical behavior).
      const nextExpanded = partial.expanded
      store.batch(() => {
        if (nextExpanded) expansion.set(nextExpanded)
        store.setState((prev) => ({ ...prev, config: currentConfig }))
        recompute()
      })
    },
  }

  return api
}
