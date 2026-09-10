import { computed, ref, toValue, type ComputedRef, type MaybeRefOrGetter, type Ref } from 'vue'
import {
  createTableMultiSortComparator,
  createTableSortComparator,
  sortTableRows,
  type FormulaTables,
} from '@iris-ui-kit/core'
import { getCellValue } from './table-helpers'
import type { IrisTableColumn, IrisTableSortState } from './types'

export interface UseTableSortOptions<Row> {
  leafColumns: MaybeRefOrGetter<IrisTableColumn<Row>[]>
  sort?: MaybeRefOrGetter<IrisTableSortState | null | undefined>
  defaultSort?: IrisTableSortState | null
  onSortChange?: (next: IrisTableSortState | null) => void
  /** Multi-column sort mode (vxe sort-config.multiple parity). When on, header
   * cycling appends/removes columns (see {@link cycleMultiSort}) and the sorted
   * data uses the chained multi comparator. Default false. */
  multiSort?: MaybeRefOrGetter<boolean | undefined>
  /** Controlled multi-column sort state (multiSort mode). */
  multiSortState?: MaybeRefOrGetter<IrisTableSortState[] | undefined>
  /** Default multi-column sort (multiSort mode, uncontrolled). */
  defaultMultiSort?: IrisTableSortState[] | undefined
  /** Called when the multi-column sort changes. */
  onMultiSortChange?: (next: IrisTableSortState[]) => void
  /** External table rows used by formula-column comparators. */
  formulaTables?: MaybeRefOrGetter<FormulaTables | undefined>
}

export interface UseTableSortResult<Row> {
  sortState: ComputedRef<IrisTableSortState | null>
  cycleSort: (col: IrisTableColumn<Row>) => void
  setSort: (next: IrisTableSortState | null) => void
  sortComparator: ComputedRef<((a: Row, b: Row) => number) | null>
  sortedData: ComputedRef<Row[]>
  /** Current multi-column sort state (controlled if a `multiSortState` option was provided, else internal). */
  multiSortState: ComputedRef<IrisTableSortState[]>
  /** Cycle a column in multi mode: append asc → asc→desc → remove from the list. */
  cycleMultiSort: (col: IrisTableColumn<Row>) => void
  /** Directly set the multi-column sort list. */
  setMultiSort: (next: IrisTableSortState[]) => void
  /** Multi-column comparator (multiSort mode): per-column comparators chained
   * in click order, first non-zero wins; null when the list is empty. */
  multiSortComparator: ComputedRef<((a: Row, b: Row) => number) | null>
}

/**
 * Legacy pure helper kept for existing Vue table consumers. Comparator
 * construction lives in Core; this wrapper only supplies Vue's
 * formula-aware value resolver.
 */
export function buildMultiSortComparator<Row extends Record<string, unknown>>(
  leafColumns: IrisTableColumn<Row>[],
  state: IrisTableSortState[],
  formulaTables?: FormulaTables,
): ((a: Row, b: Row) => number) | null {
  return createTableMultiSortComparator(state, leafColumns, (row, column) =>
    getCellValue(row, column, formulaTables),
  )
}

/**
 * Vue composable for table sort state management.
 * Handles controlled/uncontrolled sort, comparator generation, and sorted data.
 * In multiSort mode header cycling appends/removes columns (vxe
 * sort-config.multiple parity) and the sorted data uses the chained comparator.
 */
export function useTableSort<Row extends Record<string, unknown>>(
  data: Ref<Row[]>,
  options: UseTableSortOptions<Row>,
): UseTableSortResult<Row> {
  const sortProp = computed(() => (options.sort === undefined ? undefined : toValue(options.sort)))
  const internalSortValue = ref<IrisTableSortState | null>(options.defaultSort ?? null)

  const sortState = computed<IrisTableSortState | null>({
    get: () => (sortProp.value === undefined ? internalSortValue.value : (sortProp.value ?? null)),
    set: (val) => {
      if (sortProp.value === undefined) internalSortValue.value = val
      options.onSortChange?.(val)
    },
  })

  // -------- Multi-column mode (vxe sort-config.multiple parity) --------
  // Array order = click order (most-significant first). Controlled or internal
  // exactly like the single-column state above.
  const multiEnabled = computed(() => toValue(options.multiSort) === true)
  const multiSortProp = computed(() =>
    options.multiSortState === undefined ? undefined : toValue(options.multiSortState),
  )
  const internalMultiSort = ref<IrisTableSortState[]>(options.defaultMultiSort ?? [])

  const multiSortState = computed<IrisTableSortState[]>({
    get: () => (multiSortProp.value === undefined ? internalMultiSort.value : multiSortProp.value),
    set: (val) => {
      if (multiSortProp.value === undefined) internalMultiSort.value = val
      options.onMultiSortChange?.(val)
    },
  })
  const formulaTables = computed(() =>
    options.formulaTables === undefined ? undefined : toValue(options.formulaTables),
  )

  const getValue = (row: Row, column: IrisTableColumn<Row>): unknown =>
    getCellValue(row, column, formulaTables.value)

  const sortComparator = computed<((a: Row, b: Row) => number) | null>(() =>
    createTableSortComparator(sortState.value, toValue(options.leafColumns), getValue),
  )

  const multiSortComparator = computed<((a: Row, b: Row) => number) | null>(() =>
    createTableMultiSortComparator(multiSortState.value, toValue(options.leafColumns), getValue),
  )

  const sortedData = computed<Row[]>(() =>
    sortTableRows(data.value, toValue(options.leafColumns), {
      mode: multiEnabled.value ? 'multiple' : 'single',
      sort: sortState.value,
      multiSort: multiSortState.value,
      getValue,
    }),
  )

  function setSort(next: IrisTableSortState | null): void {
    if (sortProp.value === undefined) internalSortValue.value = next
    options.onSortChange?.(next)
  }

  function cycleSort(col: IrisTableColumn<Row>): void {
    if (!col.sortable) return
    const s = sortState.value
    if (!s || s.key !== col.key) {
      setSort({ key: col.key, direction: 'asc' })
      return
    }
    if (s.direction === 'asc') {
      setSort({ key: col.key, direction: 'desc' })
      return
    }
    setSort(null)
  }

  function setMultiSort(next: IrisTableSortState[]): void {
    if (multiSortProp.value === undefined) internalMultiSort.value = next
    options.onMultiSortChange?.(next)
  }

  // Multi cycle: a column not in the list APPENDS asc; an existing column
  // cycles asc → desc → REMOVE (vxe sort-config.multiple + chronological).
  function cycleMultiSort(col: IrisTableColumn<Row>): void {
    if (!col.sortable) return
    const idx = multiSortState.value.findIndex((s) => s.key === col.key)
    if (idx < 0) {
      setMultiSort([...multiSortState.value, { key: col.key, direction: 'asc' }])
      return
    }
    const next = [...multiSortState.value]
    if (next[idx]!.direction === 'asc') {
      next[idx] = { key: col.key, direction: 'desc' }
      setMultiSort(next)
      return
    }
    next.splice(idx, 1)
    setMultiSort(next)
  }

  return {
    sortState,
    cycleSort,
    setSort,
    sortComparator,
    sortedData,
    multiSortState,
    cycleMultiSort,
    setMultiSort,
    multiSortComparator,
  }
}
