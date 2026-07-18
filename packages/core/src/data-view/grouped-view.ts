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
 * Usage:
 * ```ts
 * const grouped = createGroupedView({ keyOf: (r) => r.category })
 * // After data arrives:
 * grouped.setRows(myRows)
 * // Read the computed state:
 * const state = grouped.getState()
 * // state.groups → [{ key: 'cat1', rows: [...] }, ...]
 * // state.expanded → Set of keys currently open
 * ```
 */

import { createStore, type Store } from '../store'
import { groupRows } from './aggregate'
import type { GroupedViewConfig, GroupedViewState, AggregateSpec, DataViewColumn } from './types'

/**
 * GroupedView controller state, stored in a subscribable {@link Store} so
 * framework adapters can bridge it to their reactivity model.
 */
export interface GroupedViewStore<Row, K = string> {
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
export function createGroupedView<Row, K = string>(
  config: GroupedViewConfig<Row, K>,
): {
  /** Subscribable store with the full grouped state. */
  store: Store<GroupedViewStore<Row, K>>
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
  // Internal expanded set: controlled via config.expanded if provided, else internal.
  const defaultExpanded = new Set<K>(config.defaultExpanded ?? [])
  let expandedSet = new Set<K>(defaultExpanded)
  let currentRows: readonly Row[] = []
  let currentColumns: readonly DataViewColumn<Row>[] = []

  const initialConfig: GroupedViewConfig<Row, K> = { ...config }

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
          const nums: number[] = []
          for (const row of group.rows) {
            const raw = col.getValue(row)
            if (raw != null) {
              const v = Number(raw)
              if (Number.isFinite(v)) nums.push(v)
            }
          }
          // Use `${key}_${op}` as output key to avoid collisions when multiple
          // aggregate ops target the same column.
          const outKey = `${spec.key}_${spec.op}`
          if (nums.length > 0) {
            switch (spec.op) {
              case 'sum':
                vals[outKey] = nums.reduce((a, b) => a + b, 0)
                break
              case 'avg':
                vals[outKey] = nums.reduce((a, b) => a + b, 0) / nums.length
                break
              case 'min':
                vals[outKey] = Math.min(...nums)
                break
              case 'max':
                vals[outKey] = Math.max(...nums)
                break
              case 'count':
                vals[outKey] = nums.length
                break
            }
          } else {
            vals[outKey] = spec.op === 'count' ? 0 : NaN
          }
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
    // Use config.expanded if controlled.
    const expanded = cfg.expanded ? new Set(cfg.expanded) : expandedSet
    if (cfg.expanded) expandedSet = new Set(cfg.expanded)
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

  let currentConfig: GroupedViewConfig<Row, K> = { ...initialConfig }

  function recompute(): void {
    store.setState((prev) => ({
      ...prev,
      state: buildState(currentRows, currentColumns, currentConfig),
    }))
  }

  const api = {
    store,

    setRows(rows: readonly Row[], columns?: readonly DataViewColumn<Row>[]): void {
      currentRows = rows
      if (columns) currentColumns = columns
      recompute()
    },

    toggleGroup(key: K): void {
      if (currentConfig.expanded) return // controlled — no internal mutation
      if (expandedSet.has(key)) {
        expandedSet = new Set([...expandedSet].filter((k) => k !== key))
      } else {
        expandedSet = new Set([...expandedSet, key])
      }
      currentConfig.onExpandedChange?.([...expandedSet])
      recompute()
    },

    expandGroup(key: K): void {
      if (currentConfig.expanded) return
      if (!expandedSet.has(key)) {
        expandedSet = new Set([...expandedSet, key])
        currentConfig.onExpandedChange?.([...expandedSet])
        recompute()
      }
    },

    collapseGroup(key: K): void {
      if (currentConfig.expanded) return
      if (expandedSet.has(key)) {
        expandedSet = new Set([...expandedSet].filter((k) => k !== key))
        currentConfig.onExpandedChange?.([...expandedSet])
        recompute()
      }
    },

    expandAll(): void {
      if (currentConfig.expanded) return
      const allKeys = currentRows.map((r) => currentConfig.keyOf(r))
      expandedSet = new Set(allKeys)
      currentConfig.onExpandedChange?.([...expandedSet])
      recompute()
    },

    collapseAll(): void {
      if (currentConfig.expanded) return
      expandedSet = new Set<K>()
      currentConfig.onExpandedChange?.([...expandedSet])
      recompute()
    },

    getState(): GroupedViewState<Row, K> {
      return store.getState().state
    },

    setConfig(partial: Partial<GroupedViewConfig<Row, K>>): void {
      currentConfig = { ...currentConfig, ...partial }
      // If expanded is being controlled externally, sync.
      if (partial.expanded) {
        expandedSet = new Set(partial.expanded)
      }
      store.setState((prev) => ({
        ...prev,
        config: currentConfig,
      }))
      recompute()
    },
  }

  return api
}
