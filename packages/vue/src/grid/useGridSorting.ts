import { computed, shallowRef, watch, type ComputedRef } from 'vue'
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
export interface UseGridSortingResult {
  model: GridSortingModel
  sort: ComputedRef<SortState | null>
  multiSort: ComputedRef<SortState[]>
  cycleSort(key: string): void
  setSort(sort: SortState | null): void
  cycleMultiSort(key: string): void
  setMultiSort(sorts: SortState[]): void
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
): UseGridSortingResult {
  const latest = shallowRef(options)
  const model = useGridFeature<Row, GridSortingModel>(core, 'sorting', 'getSortingModel', () =>
    createGridSortingFeature<Row>({
      mode: options.mode,
      defaultSort: options.sort !== undefined ? options.sort : options.defaultSort,
      defaultMultiSort:
        options.multiSortState !== undefined ? options.multiSortState : options.defaultMultiSort,
      onSortChange: (v) => latest.value.onSortChange?.(v),
      onMultiSortChange: (v) => latest.value.onMultiSortChange?.(v),
    }),
  )
  const state = useStore(model.store)
  let wasSortControlled = options.sort !== undefined
  let hasUncontrolledSort = !wasSortControlled
  const uncontrolledSort = shallowRef<SortState | null>(
    wasSortControlled ? null : cloneSort(state.value.sort),
  )
  const lastControlledSort = shallowRef<SortState | null>(cloneSort(options.sort ?? null))
  let wasMultiSortControlled = options.multiSortState !== undefined
  let hasUncontrolledMultiSort = !wasMultiSortControlled
  const uncontrolledMultiSort = shallowRef<SortState[]>(
    wasMultiSortControlled ? [] : cloneSorts(state.value.multiSort),
  )
  const lastControlledMultiSort = shallowRef<SortState[]>(cloneSorts(options.multiSortState ?? []))

  watch(
    state,
    (current) => {
      if (!wasSortControlled) {
        uncontrolledSort.value = cloneSort(current.sort)
        hasUncontrolledSort = true
      }
      if (!wasMultiSortControlled) {
        uncontrolledMultiSort.value = cloneSorts(current.multiSort)
        hasUncontrolledMultiSort = true
      }
    },
    { flush: 'sync' },
  )
  watch(
    () => options.sort,
    (value) => {
      const controlled = value !== undefined
      const wasControlled = wasSortControlled
      if (controlled && !wasControlled) {
        // Capture the live Core state before synchronizing the controlled sort.
        uncontrolledSort.value = cloneSort(model.store.getState().sort)
        hasUncontrolledSort = true
      }
      wasSortControlled = controlled
      if (controlled) {
        lastControlledSort.value = cloneSort(value ?? null)
        model.syncSort(value ?? null)
      } else if (wasControlled) {
        const restore = hasUncontrolledSort ? uncontrolledSort.value : lastControlledSort.value
        if (!hasUncontrolledSort) {
          uncontrolledSort.value = cloneSort(restore)
          hasUncontrolledSort = true
        }
        model.syncSort(restore)
      }
    },
    { deep: true, immediate: true, flush: 'sync' },
  )
  watch(
    () => options.multiSortState,
    (value) => {
      const controlled = value !== undefined
      const wasControlled = wasMultiSortControlled
      wasMultiSortControlled = controlled
      if (controlled) {
        // Preserve model updates batched with the transition into control.
        if (!wasControlled) {
          uncontrolledMultiSort.value = cloneSorts(model.store.getState().multiSort)
          hasUncontrolledMultiSort = true
        }
        lastControlledMultiSort.value = cloneSorts(value ?? [])
        model.syncMultiSort(value ?? [])
      } else if (wasControlled) {
        const restore = hasUncontrolledMultiSort
          ? uncontrolledMultiSort.value
          : lastControlledMultiSort.value
        // A no-op Core sync still establishes the handoff as the next
        // uncontrolled baseline for a later controlled detour.
        uncontrolledMultiSort.value = cloneSorts(restore)
        hasUncontrolledMultiSort = true
        model.syncMultiSort(restore)
      }
    },
    { deep: true, immediate: true, flush: 'sync' },
  )
  return {
    model,
    sort: computed(() => {
      const value = options.sort
      const current = state.value
      if (value !== undefined) return cloneSort(value)
      return cloneSort(
        wasSortControlled
          ? hasUncontrolledSort
            ? uncontrolledSort.value
            : lastControlledSort.value
          : current.sort,
      )
    }),
    multiSort: computed(() => {
      const value = options.multiSortState
      const current = state.value
      if (value !== undefined) return cloneSorts(value ?? [])
      return cloneSorts(
        wasMultiSortControlled
          ? hasUncontrolledMultiSort
            ? uncontrolledMultiSort.value
            : lastControlledMultiSort.value
          : current.multiSort,
      )
    }),
    cycleSort: (key) => {
      const value = options.sort
      if (value !== undefined) model.syncSort(value)
      model.cycleSort(key)
    },
    setSort: (v) => model.setSort(v),
    cycleMultiSort: (key) => {
      const value = options.multiSortState
      if (value !== undefined) model.syncMultiSort(value)
      model.cycleMultiSort(key)
    },
    setMultiSort: (v) => model.setMultiSort(v),
  }
}
