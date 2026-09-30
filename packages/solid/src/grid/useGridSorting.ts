import { createEffect, type Accessor } from 'solid-js'
import {
  createGridSortingFeature,
  type GridCore,
  type GridSortingModel,
  type SortState,
} from '@iris-ui-kit/core/grid'
import { useStore } from '../useStore'
import { useGridFeature } from './useGridFeature'

export interface UseGridSortingOptions {
  mode?: 'single' | 'multiple'
  sort?: SortState | null
  defaultSort?: SortState | null
  onSortChange?: (sort: SortState | null) => void
  multiSortState?: SortState[]
  defaultMultiSort?: SortState[]
  onMultiSortChange?: (sorts: SortState[]) => void
}

function cloneSort(sort: SortState | null): SortState | null {
  return sort ? { ...sort } : null
}

function cloneSorts(sorts: readonly SortState[]): SortState[] {
  return sorts.map((sort) => ({ ...sort }))
}

export function useGridSorting<Row extends Record<string, unknown> = Record<string, unknown>>(
  core: GridCore<Row>,
  options: UseGridSortingOptions = {},
): {
  model: GridSortingModel
  sort: Accessor<SortState | null>
  multiSort: Accessor<SortState[]>
  cycleSort(key: string): void
  setSort(sort: SortState | null): void
  cycleMultiSort(key: string): void
  setMultiSort(sorts: SortState[]): void
} {
  const latest = options
  const model = useGridFeature<Row, GridSortingModel>(core, 'sorting', 'getSortingModel', () =>
    createGridSortingFeature<Row>({
      mode: options.mode,
      defaultSort: options.sort !== undefined ? options.sort : options.defaultSort,
      defaultMultiSort:
        options.multiSortState !== undefined ? options.multiSortState : options.defaultMultiSort,
      onSortChange: (v) => latest.onSortChange?.(v),
      onMultiSortChange: (v) => latest.onMultiSortChange?.(v),
    }),
  )
  const state = useStore(model.store)
  let wasSortControlled = options.sort !== undefined
  let hasUncontrolledSort = !wasSortControlled
  let uncontrolledSort = cloneSort(state().sort)
  let lastControlledSort = cloneSort(options.sort ?? null)
  let wasMultiSortControlled = options.multiSortState !== undefined
  let hasUncontrolledMultiSort = !wasMultiSortControlled
  let uncontrolledMultiSort = cloneSorts(state().multiSort)
  let lastControlledMultiSort = cloneSorts(options.multiSortState ?? [])

  createEffect(() => {
    const sort = options.sort
    const multiSortState = options.multiSortState
    const sortControlled = sort !== undefined
    const multiSortControlled = multiSortState !== undefined
    // Read nested fields so reactive prop proxies also observe in-place changes.
    void JSON.stringify(sort)
    void JSON.stringify(multiSortState)

    // Capture both sorting channels from the live Core state before either
    // controlled sync runs; the Solid store mirror may still be pre-batch.
    if (
      (sortControlled && !wasSortControlled) ||
      (multiSortControlled && !wasMultiSortControlled)
    ) {
      const current = model.store.getState()
      if (sortControlled && !wasSortControlled) {
        uncontrolledSort = cloneSort(current.sort)
        hasUncontrolledSort = true
      }
      if (multiSortControlled && !wasMultiSortControlled) {
        uncontrolledMultiSort = cloneSorts(current.multiSort)
        hasUncontrolledMultiSort = true
      }
    }

    if (sortControlled) {
      lastControlledSort = cloneSort(sort ?? null)
      model.syncSort(sort)
    } else if (wasSortControlled) {
      const restore = hasUncontrolledSort ? uncontrolledSort : lastControlledSort
      if (!hasUncontrolledSort) {
        uncontrolledSort = cloneSort(restore)
        hasUncontrolledSort = true
      }
      model.syncSort(restore)
    }
    if (multiSortControlled) {
      lastControlledMultiSort = cloneSorts(multiSortState)
      model.syncMultiSort(multiSortState)
    } else if (wasMultiSortControlled) {
      const restore = hasUncontrolledMultiSort ? uncontrolledMultiSort : lastControlledMultiSort
      // A no-op Core sync still establishes the restored value as the next
      // uncontrolled baseline for a later controlled detour.
      uncontrolledMultiSort = cloneSorts(restore)
      hasUncontrolledMultiSort = true
      model.syncMultiSort(restore)
    }
    wasSortControlled = sortControlled
    wasMultiSortControlled = multiSortControlled
  })
  createEffect(() => {
    const current = state()
    if (!wasSortControlled) {
      uncontrolledSort = cloneSort(current.sort)
      hasUncontrolledSort = true
    }
    if (!wasMultiSortControlled) {
      uncontrolledMultiSort = cloneSorts(current.multiSort)
      hasUncontrolledMultiSort = true
    }
  })
  return {
    model,
    sort: () => {
      // Read the store unconditionally so every consumer computation keeps its
      // subscription across a controlled -> uncontrolled handoff; the value is
      // only used in the uncontrolled branch.
      const current = state()
      const sort = options.sort
      if (sort !== undefined) return cloneSort(sort)
      return cloneSort(
        wasSortControlled
          ? hasUncontrolledSort
            ? uncontrolledSort
            : lastControlledSort
          : current.sort,
      )
    },
    multiSort: () => {
      const current = state()
      const multiSortState = options.multiSortState
      if (multiSortState !== undefined) return cloneSorts(multiSortState)
      return cloneSorts(
        wasMultiSortControlled
          ? hasUncontrolledMultiSort
            ? uncontrolledMultiSort
            : lastControlledMultiSort
          : current.multiSort,
      )
    },
    cycleSort: (key) => {
      const sort = options.sort
      if (sort !== undefined) model.syncSort(sort)
      model.cycleSort(key)
    },
    setSort: (v) => model.setSort(v),
    cycleMultiSort: (key) => {
      const multiSortState = options.multiSortState
      if (multiSortState !== undefined) model.syncMultiSort(multiSortState)
      model.cycleMultiSort(key)
    },
    setMultiSort: (v) => model.setMultiSort(v),
  }
}
